import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Digest, User } from "@/db/schema";
import { staticBaseUrl } from "@/lib/base-url";
import { formatDate, utcToWall, weekdayIn } from "@/lib/dates";
import { getSmsProvider } from "@/lib/messaging/providers";
import { buildDigest, type DigestSummary } from "./build";
import { renderDigestText } from "./render";

export type { DigestEvent, DigestSummary } from "./build";
export { renderDigestText, whenLabel } from "./render";

const { digests, users } = schema;

export type DigestUser = Pick<User, "id" | "email" | "displayName" | "phoneE164" | "timezone" | "digestFrequency" | "digestHour" | "digestWeekday">;

const USER_COLUMNS = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  phoneE164: users.phoneE164,
  timezone: users.timezone,
  digestFrequency: users.digestFrequency,
  digestHour: users.digestHour,
  digestWeekday: users.digestWeekday,
};

export async function getDigestUser(userId: string): Promise<DigestUser | null> {
  const db = await getDb();
  const [row] = await db.select(USER_COLUMNS).from(users).where(eq(users.id, userId));
  return row ?? null;
}

export async function listDigests(userId: string, limit = 14): Promise<Digest[]> {
  const db = await getDb();
  return db.select().from(digests).where(eq(digests.userId, userId)).orderBy(desc(digests.createdAt)).limit(limit);
}

/** Stored JSON back into a summary, or null if it's from a shape we no longer read. */
export function summaryOf(d: Digest): DigestSummary | null {
  const s = d.summary as Partial<DigestSummary> | null;
  return s && s.version === 1 && Array.isArray(s.events) ? (s as DigestSummary) : null;
}

/** The period a digest at `now` belongs to, or null if none is due for this host. */
export function duePeriodKey(user: DigestUser, now = new Date()): string | null {
  if (user.digestFrequency === "off") return null;
  const wall = utcToWall(now, user.timezone);
  const date = wall.slice(0, 10);
  const hour = Number(wall.slice(11, 13));
  if (hour < user.digestHour) return null;
  if (user.digestFrequency === "daily") return date;
  return weekdayIn(now, user.timezone) === user.digestWeekday ? `week-${date}` : null;
}

export type SendOutcome = { digest: Digest; delivered: boolean; error: string | null } | null;

/**
 * Builds, stores and (when the host has a number) texts one digest. The
 * (user, periodKey) unique index makes a second call for the same period a
 * no-op, so the heartbeat and a cron hit can overlap safely.
 */
export async function sendDigest(user: DigestUser, trigger: "scheduled" | "manual", periodKey: string, now = new Date()): Promise<SendOutcome> {
  const db = await getDb();
  const [previous] = await db
    .select({ createdAt: digests.createdAt })
    .from(digests)
    .where(eq(digests.userId, user.id))
    .orderBy(desc(digests.createdAt))
    .limit(1);
  const since = previous?.createdAt ?? new Date(now.getTime() - 24 * 3_600_000);
  const summary = await buildDigest(since, now);
  const body = renderDigestText(summary, { hostName: user.displayName, baseUrl: staticBaseUrl(), dateLabel: formatDate(now, user.timezone) });

  const [row] = await db
    .insert(digests)
    .values({ userId: user.id, periodKey, trigger, since, summary, body, toPhone: user.phoneE164 })
    .onConflictDoNothing({ target: [digests.userId, digests.periodKey] })
    .returning();
  if (!row) return null;

  let delivered = false;
  let error: string | null = null;
  let digest = row;
  if (user.phoneE164) {
    try {
      const result = await getSmsProvider().send({ to: user.phoneE164, body, idempotencyKey: `digest:${row.id}` });
      [digest] = await db
        .update(digests)
        .set({ status: "sent", providerMessageId: result.providerMessageId, sentAt: new Date() })
        .where(eq(digests.id, row.id))
        .returning();
      delivered = true;
    } catch (err) {
      error = err instanceof Error ? err.message : "send failed";
      [digest] = await db.update(digests).set({ status: "failed", error }).where(eq(digests.id, row.id)).returning();
      console.error("[digest] send failed", err);
    }
  }
  await db.insert(schema.auditLog).values({
    actor: user.email,
    action: "digest.generated",
    metadata: { digestId: row.id, trigger, periodKey, delivered, error, alerts: summary.alertCount, events: summary.events.length },
  });
  return { digest, delivered, error };
}

/** Heartbeat entry point: one digest per host whose time has come. */
export async function runDueDigests(now = new Date()): Promise<number> {
  const db = await getDb();
  const hosts = await db.select(USER_COLUMNS).from(users).where(ne(users.digestFrequency, "off"));
  let sent = 0;
  for (const user of hosts) {
    const key = duePeriodKey(user, now);
    if (!key) continue;
    // Cheap check first so the minute heartbeat doesn't rebuild a summary
    // it would only throw away on the unique index.
    const [existing] = await db
      .select({ id: digests.id })
      .from(digests)
      .where(and(eq(digests.userId, user.id), eq(digests.periodKey, key)))
      .limit(1);
    if (existing) continue;
    const outcome = await sendDigest(user, "scheduled", key, now);
    if (outcome) sent++;
  }
  return sent;
}
