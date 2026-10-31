import "server-only";
import { and, eq, gt, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getContestView } from "@/lib/contest";
import { daysUntil } from "@/lib/dates";
import { getEventContributions, getEventTasks, listEventSummaries } from "@/lib/queries";

const { rsvps, contributions, photos, messageJobs, messages } = schema;

/** One event's slice of a digest. Plain JSON so it can live in the digests table. */
export type DigestEvent = {
  id: string;
  title: string;
  startsAt: string;
  timezone: string;
  status: string;
  daysUntil: number;
  rsvp: { invited: number; attending: number; maybe: number; declined: number; pending: number; headcount: number; newReplies: number };
  tasks: { open: number; overdue: number; dueSoon: string[] };
  contributions: { slots: number; unfilled: number; newClaims: number };
  photos: { total: number; pending: number; added: number };
  contest: { title: string; status: string; entries: number; pendingEntries: number; votes: number } | null;
  messages: { upcoming: string[]; failed: number; dead: number };
  alerts: string[];
};

export type DigestSummary = {
  version: 1;
  generatedAt: string;
  since: string;
  events: DigestEvent[];
  alertCount: number;
};

const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
const n = (c: number, noun: string, plural = `${noun}s`) => `${c} ${c === 1 ? noun : plural}`;

/**
 * Everything a host would want to glance at: where each live event stands,
 * what changed since the previous digest, and anything that needs a hand.
 */
export async function buildDigest(since: Date, now = new Date()): Promise<DigestSummary> {
  const db = await getDb();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const soon = new Date(now.getTime() + 48 * 3_600_000);
  const dayAhead = new Date(now.getTime() + 24 * 3_600_000);
  const all = await listEventSummaries();
  const live = all.filter((e) => e.status !== "archived" && e.startsAt >= weekAgo);

  const events: DigestEvent[] = [];
  for (const e of live) {
    const [taskRows, contrib, contest, newReplies, newClaims, photoAgg, newPhotos, jobAgg, upcoming] = await Promise.all([
      getEventTasks(e.id),
      getEventContributions(e.id),
      getContestView(e.id),
      count(
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(rsvps)
          .where(and(eq(rsvps.eventId, e.id), gt(rsvps.updatedAt, since), ne(rsvps.status, "pending"))),
      ),
      count(db.select({ n: sql<number>`count(*)::int` }).from(contributions).where(and(eq(contributions.eventId, e.id), gt(contributions.createdAt, since)))),
      db
        .select({ state: photos.state, n: sql<number>`count(*)::int` })
        .from(photos)
        .where(eq(photos.eventId, e.id))
        .groupBy(photos.state),
      count(db.select({ n: sql<number>`count(*)::int` }).from(photos).where(and(eq(photos.eventId, e.id), gt(photos.createdAt, since)))),
      db
        .select({ state: messageJobs.state, n: sql<number>`count(*)::int` })
        .from(messageJobs)
        .where(and(eq(messageJobs.eventId, e.id), inArray(messageJobs.state, ["failed", "dead"])))
        .groupBy(messageJobs.state),
      db
        .select({ label: messages.label })
        .from(messages)
        .where(and(eq(messages.eventId, e.id), eq(messages.status, "scheduled"), gte(messages.scheduledAt, now), lte(messages.scheduledAt, dayAhead))),
    ]);

    const openTasks = taskRows.filter((t) => t.status !== "done");
    const dueSoon = openTasks
      .filter((t) => t.dueAt && t.dueAt >= now && t.dueAt <= soon)
      .map((t) => `${t.title}${t.assigneeName ? ` (${t.assigneeName})` : ""}`)
      .slice(0, 3);
    const unfilled = contrib.slots.filter((s) => (s.capacity ? s.claims.length < s.capacity : s.claims.length === 0)).length;
    const photoTotal = photoAgg.reduce((a, r) => a + r.n, 0);
    const pendingPhotos = photoAgg.find((r) => r.state === "pending")?.n ?? 0;
    const failed = jobAgg.find((r) => r.state === "failed")?.n ?? 0;
    const dead = jobAgg.find((r) => r.state === "dead")?.n ?? 0;
    const days = daysUntil(e.startsAt, e.timezone, now);
    const pendingEntries = contest ? contest.entries.filter((x) => !x.approved).length : 0;
    const votes = contest ? Object.values(contest.tallies).reduce((a, by) => a + Object.values(by).reduce((x, y) => x + y, 0), 0) : 0;

    const alerts: string[] = [];
    if (e.overdueTasks > 0) alerts.push(`${n(e.overdueTasks, "task")} overdue`);
    if (e.rsvpDeadline && e.rsvpDeadline < now && e.pending > 0 && days >= 0) {
      alerts.push(`RSVP deadline has passed and ${n(e.pending, "household")} ${e.pending === 1 ? "hasn't" : "haven't"} replied`);
    }
    if (dead > 0) alerts.push(`${n(dead, "text")} couldn't be delivered`);
    if (pendingPhotos > 0) alerts.push(`${n(pendingPhotos, "photo")} waiting for approval`);
    if (pendingEntries > 0) alerts.push(`${n(pendingEntries, "contest entry", "contest entries")} waiting for approval`);
    if (e.status === "draft" && days >= 0 && days <= 14) alerts.push("Still a draft: invitations aren't open yet");
    if (days >= 0 && days <= 3 && unfilled > 0) alerts.push(`${n(unfilled, "sign-up slot")} still unfilled`);

    events.push({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      timezone: e.timezone,
      status: e.status,
      daysUntil: days,
      rsvp: { invited: e.invited, attending: e.attending, maybe: e.maybe, declined: e.declined, pending: e.pending, headcount: e.headcount, newReplies },
      tasks: { open: openTasks.length, overdue: e.overdueTasks, dueSoon },
      contributions: { slots: contrib.slots.length, unfilled, newClaims },
      photos: { total: photoTotal, pending: pendingPhotos, added: newPhotos },
      contest: contest ? { title: contest.contest.title, status: contest.contest.status, entries: contest.entries.length, pendingEntries, votes } : null,
      messages: { upcoming: upcoming.map((m) => m.label), failed, dead },
      alerts,
    });
  }

  return {
    version: 1,
    generatedAt: now.toISOString(),
    since: since.toISOString(),
    events,
    alertCount: events.reduce((a, e) => a + e.alerts.length, 0),
  };
}

