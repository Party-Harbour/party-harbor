import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Contest, ContestCategory, ContestEntry, Rsvp } from "@/db/schema";

const { contests, contestCategories, contestEntries, votes, eventInvites, households, rsvps } = schema;

export type EntryRow = ContestEntry & { bakerName: string | null };

export type ContestView = {
  contest: Contest;
  categories: ContestCategory[];
  entries: EntryRow[];
  /** categoryId → entryId → vote count */
  tallies: Record<string, Record<string, number>>;
  /** categoryId → number of households that voted */
  votersByCategory: Record<string, number>;
  eligibleVoters: number;
};

export async function getContestView(eventId: string): Promise<ContestView | null> {
  const db = await getDb();
  const [contest] = await db.select().from(contests).where(eq(contests.eventId, eventId));
  if (!contest) return null;

  const [categories, entryRows, voteRows, eligible] = await Promise.all([
    db
      .select()
      .from(contestCategories)
      .where(eq(contestCategories.contestId, contest.id))
      .orderBy(asc(contestCategories.sortOrder), asc(contestCategories.createdAt)),
    db
      .select({ entry: contestEntries, bakerName: households.name })
      .from(contestEntries)
      .leftJoin(eventInvites, eq(contestEntries.inviteId, eventInvites.id))
      .leftJoin(households, eq(eventInvites.householdId, households.id))
      .where(eq(contestEntries.contestId, contest.id))
      .orderBy(asc(contestEntries.createdAt)),
    db
      .select({ categoryId: votes.categoryId, entryId: votes.entryId, inviteId: votes.inviteId })
      .from(votes)
      .where(eq(votes.contestId, contest.id)),
    countEligibleVoters(eventId, contest.voterEligibility),
  ]);

  const tallies: Record<string, Record<string, number>> = {};
  const voterSets: Record<string, Set<string>> = {};
  for (const v of voteRows) {
    tallies[v.categoryId] ??= {};
    tallies[v.categoryId][v.entryId] = (tallies[v.categoryId][v.entryId] ?? 0) + 1;
    (voterSets[v.categoryId] ??= new Set()).add(v.inviteId);
  }
  const votersByCategory = Object.fromEntries(
    Object.entries(voterSets).map(([k, s]) => [k, s.size]),
  );

  return {
    contest,
    categories,
    entries: entryRows.map((r) => ({ ...r.entry, bakerName: r.bakerName })),
    tallies,
    votersByCategory,
    eligibleVoters: eligible,
  };
}

async function countEligibleVoters(
  eventId: string,
  eligibility: Contest["voterEligibility"],
): Promise<number> {
  const db = await getDb();
  if (eligibility === "attending_only") {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(eventInvites)
      .innerJoin(rsvps, eq(rsvps.inviteId, eventInvites.id))
      .where(
        and(
          eq(eventInvites.eventId, eventId),
          isNull(eventInvites.revokedAt),
          eq(rsvps.status, "attending"),
        ),
      );
    return row?.n ?? 0;
  }
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(eventInvites)
    .where(and(eq(eventInvites.eventId, eventId), isNull(eventInvites.revokedAt)));
  return row?.n ?? 0;
}

export type GuestContestState = {
  myEntries: ContestEntry[];
  /** categoryId → entryId */
  myVotes: Record<string, string>;
  eligible: boolean;
};

export async function getGuestContestState(
  contest: Contest,
  inviteId: string,
  rsvp: Rsvp | undefined,
): Promise<GuestContestState> {
  const db = await getDb();
  const [myEntries, myVoteRows] = await Promise.all([
    db
      .select()
      .from(contestEntries)
      .where(and(eq(contestEntries.contestId, contest.id), eq(contestEntries.inviteId, inviteId)))
      .orderBy(asc(contestEntries.createdAt)),
    db
      .select({ categoryId: votes.categoryId, entryId: votes.entryId })
      .from(votes)
      .where(and(eq(votes.contestId, contest.id), eq(votes.inviteId, inviteId))),
  ]);
  const eligible =
    contest.voterEligibility === "all_invited" || rsvp?.status === "attending";
  return {
    myEntries,
    myVotes: Object.fromEntries(myVoteRows.map((v) => [v.categoryId, v.entryId])),
    eligible,
  };
}

export type CategoryResult = {
  category: ContestCategory;
  total: number;
  rows: { entry: EntryRow; count: number; pct: number; winner: boolean }[];
};

/** Ranked results per category. Ties share the win (tie-break policy is an open PRD decision). */
export function computeResults(view: ContestView): CategoryResult[] {
  const approved = view.entries.filter((e) => e.approved);
  return view.categories.map((category) => {
    const tally = view.tallies[category.id] ?? {};
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    const max = Math.max(0, ...Object.values(tally));
    const rows = approved
      .map((entry) => {
        const count = tally[entry.id] ?? 0;
        return {
          entry,
          count,
          pct: total === 0 ? 0 : Math.round((count / total) * 100),
          winner: total > 0 && count === max,
        };
      })
      .sort((a, b) => b.count - a.count || a.entry.displayName.localeCompare(b.entry.displayName));
    return { category, total, rows };
  });
}

export const CONTEST_STATUS_LABEL: Record<Contest["status"], string> = {
  collecting: "Taking entries",
  frozen: "Ballot frozen",
  voting: "Voting open",
  closed: "Voting closed",
  revealed: "Results revealed",
};
