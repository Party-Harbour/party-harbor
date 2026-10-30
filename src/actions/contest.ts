"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import {
  CONTEST_STATUSES,
  SELF_VOTE_POLICIES,
  VOTER_ELIGIBILITIES,
  type Contest,
} from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { getContestView } from "@/lib/contest";
import { optional, str, type ActionState } from "@/lib/action-state";

function revalidateContest(eventId: string) {
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/e", "layout");
}

async function audit(actor: string, eventId: string, action: string, metadata: unknown) {
  const db = await getDb();
  await db.insert(schema.auditLog).values({ actor, eventId, action, metadata });
}

function parseSettings(formData: FormData) {
  const title = str(formData, "title") || "Cookie Exchange";
  const entryNoun = (str(formData, "entryNoun") || "cookie").toLowerCase();
  const selfVotePolicy = str(formData, "selfVotePolicy") as Contest["selfVotePolicy"];
  const voterEligibility = str(formData, "voterEligibility") as Contest["voterEligibility"];
  return {
    title,
    entryNoun,
    showBakers: formData.get("showBakers") === "on",
    selfVotePolicy: SELF_VOTE_POLICIES.includes(selfVotePolicy) ? selfVotePolicy : "disallowed",
    voterEligibility: VOTER_ELIGIBILITIES.includes(voterEligibility)
      ? voterEligibility
      : "all_invited",
  } as const;
}

export async function createContest(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const host = await requireHost();
  const db = await getDb();
  const settings = parseSettings(formData);
  const [created] = await db
    .insert(schema.contests)
    .values({ eventId, ...settings })
    .onConflictDoNothing({ target: schema.contests.eventId })
    .returning({ id: schema.contests.id });
  if (!created) return { error: "This event already has a contest." };
  // Sensible starter categories for a cookie exchange; hosts can edit them.
  await db.insert(schema.contestCategories).values([
    { contestId: created.id, title: "Best Overall", sortOrder: 0 },
    { contestId: created.id, title: "Most Festive", sortOrder: 1 },
  ]);
  await audit(host.email, eventId, "contest.created", settings);
  revalidateContest(eventId);
  return { ok: true, message: "Contest created." };
}

export async function updateContestSettings(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const host = await requireHost();
  const db = await getDb();
  const settings = parseSettings(formData);
  const [row] = await db
    .update(schema.contests)
    .set({ ...settings, updatedAt: new Date() })
    .where(eq(schema.contests.eventId, eventId))
    .returning({ id: schema.contests.id });
  if (!row) return { error: "Contest not found." };
  await audit(host.email, eventId, "contest.settings", settings);
  revalidateContest(eventId);
  return { ok: true, message: "Settings saved." };
}

const TRANSITIONS: Record<Contest["status"], Contest["status"][]> = {
  collecting: ["frozen"],
  frozen: ["voting", "collecting"],
  voting: ["closed"],
  closed: ["revealed", "voting"],
  revealed: ["closed"],
};

export async function setContestStatus(formData: FormData): Promise<void> {
  const host = await requireHost();
  const eventId = str(formData, "eventId");
  const status = str(formData, "status") as Contest["status"];
  if (!eventId || !CONTEST_STATUSES.includes(status)) return;
  const view = await getContestView(eventId);
  if (!view) return;
  const from = view.contest.status;
  if (!TRANSITIONS[from].includes(status)) return;

  if (status === "frozen" && from === "collecting") {
    const approved = view.entries.filter((e) => e.approved).length;
    if (view.categories.length === 0 || approved < 2) return;
  }

  const db = await getDb();
  const set: Partial<Contest> = { status, updatedAt: new Date() };
  // Reopening entries after a freeze is the audited "administrative override".
  if (status === "collecting" && from === "frozen") set.ballotVersion = view.contest.ballotVersion + 1;
  await db.update(schema.contests).set(set).where(eq(schema.contests.id, view.contest.id));
  await audit(host.email, eventId, "contest.status", {
    from,
    to: status,
    override: (from === "frozen" && status === "collecting") || (from === "closed" && status === "voting"),
  });
  revalidateContest(eventId);
}

export async function addCategory(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const host = await requireHost();
  const title = str(formData, "title");
  if (!title) return { error: "Give the category a name." };
  const view = await getContestView(eventId);
  if (!view) return { error: "Contest not found." };
  if (view.contest.status !== "collecting" && view.contest.status !== "frozen") {
    return { error: "Categories are locked once voting opens." };
  }
  const db = await getDb();
  await db.insert(schema.contestCategories).values({
    contestId: view.contest.id,
    title,
    sortOrder: view.categories.length,
  });
  await audit(host.email, eventId, "contest.category_added", { title });
  revalidateContest(eventId);
  return { ok: true, message: `Added “${title}”.` };
}

export async function deleteCategory(formData: FormData): Promise<void> {
  const host = await requireHost();
  const eventId = str(formData, "eventId");
  const categoryId = str(formData, "categoryId");
  const view = await getContestView(eventId);
  if (!view || !categoryId) return;
  if (view.contest.status !== "collecting" && view.contest.status !== "frozen") return;
  const db = await getDb();
  await db
    .delete(schema.contestCategories)
    .where(
      and(
        eq(schema.contestCategories.id, categoryId),
        eq(schema.contestCategories.contestId, view.contest.id),
      ),
    );
  await audit(host.email, eventId, "contest.category_removed", { categoryId });
  revalidateContest(eventId);
}

export async function hostAddEntry(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const host = await requireHost();
  const displayName = str(formData, "displayName");
  if (!displayName) return { error: "Give the entry a name." };
  const view = await getContestView(eventId);
  if (!view) return { error: "Contest not found." };
  if (view.contest.status !== "collecting") {
    return { error: "The ballot is frozen. Reopen entries to add more." };
  }
  const inviteId = optional(formData, "inviteId");
  const db = await getDb();
  await db.insert(schema.contestEntries).values({
    contestId: view.contest.id,
    inviteId,
    displayName,
    description: optional(formData, "description"),
    dietaryTags: optional(formData, "dietaryTags"),
  });
  await audit(host.email, eventId, "contest.entry_added", { displayName, inviteId });
  revalidateContest(eventId);
  return { ok: true, message: `Added “${displayName}”.` };
}

export async function setEntryApproved(formData: FormData): Promise<void> {
  const host = await requireHost();
  const eventId = str(formData, "eventId");
  const entryId = str(formData, "entryId");
  const approved = str(formData, "approved") === "true";
  const view = await getContestView(eventId);
  if (!view || !entryId) return;
  if (view.contest.status !== "collecting" && view.contest.status !== "frozen") return;
  const db = await getDb();
  await db
    .update(schema.contestEntries)
    .set({ approved })
    .where(
      and(eq(schema.contestEntries.id, entryId), eq(schema.contestEntries.contestId, view.contest.id)),
    );
  await audit(host.email, eventId, "contest.entry_approval", { entryId, approved });
  revalidateContest(eventId);
}

/** Allowed in any status; removing an entry mid-vote drops its votes and is audited. */
export async function deleteEntry(formData: FormData): Promise<void> {
  const host = await requireHost();
  const eventId = str(formData, "eventId");
  const entryId = str(formData, "entryId");
  const view = await getContestView(eventId);
  if (!view || !entryId) return;
  const db = await getDb();
  await db
    .delete(schema.contestEntries)
    .where(
      and(eq(schema.contestEntries.id, entryId), eq(schema.contestEntries.contestId, view.contest.id)),
    );
  await audit(host.email, eventId, "contest.entry_removed", {
    entryId,
    status: view.contest.status,
    override: view.contest.status !== "collecting",
  });
  revalidateContest(eventId);
}
