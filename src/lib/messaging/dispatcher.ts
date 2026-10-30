import "server-only";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSmsProvider } from "./providers";

const { messageJobs, messageDeliveries, messages } = schema;

/** Minutes to wait before each retry; after the last one the job is dead-lettered. */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
const MAX_ATTEMPTS = BACKOFF_MINUTES.length;
/** Per-run cap doubles as a crude rate limit (the heartbeat runs once a minute). */
const DEFAULT_BATCH = 25;

export type DispatchStats = { claimed: number; sent: number; retried: number; dead: number };

const g = globalThis as unknown as { __phDispatching?: boolean };

/**
 * Sends every job whose time has come. Safe to call from a cron hit, a host
 * button, or the dev heartbeat: a job is claimed by flipping queued→sending in
 * one UPDATE, so two overlapping runs can't send the same job twice.
 */
export async function runDueJobs(limit = DEFAULT_BATCH): Promise<DispatchStats> {
  const stats: DispatchStats = { claimed: 0, sent: 0, retried: 0, dead: 0 };
  if (g.__phDispatching) return stats;
  g.__phDispatching = true;
  try {
    const db = await getDb();
    const now = new Date();
    const due = await db
      .select({ id: messageJobs.id })
      .from(messageJobs)
      .where(and(inArray(messageJobs.state, ["queued", "failed"]), lte(messageJobs.nextAttemptAt, now)))
      .orderBy(asc(messageJobs.nextAttemptAt))
      .limit(limit);
    if (due.length === 0) return stats;

    const provider = getSmsProvider();
    const touchedMessages = new Set<string>();

    for (const { id } of due) {
      const [job] = await db
        .update(messageJobs)
        .set({ state: "sending", attempts: sql`${messageJobs.attempts} + 1`, updatedAt: new Date() })
        .where(and(eq(messageJobs.id, id), inArray(messageJobs.state, ["queued", "failed"])))
        .returning();
      if (!job) continue;
      stats.claimed++;
      touchedMessages.add(job.messageId);

      try {
        if (!job.toPhone) throw new Error("No phone number on job");
        const result = await provider.send({ to: job.toPhone, body: job.body, idempotencyKey: job.idempotencyKey });
        await db.insert(messageDeliveries).values({
          jobId: job.id,
          provider: provider.name,
          providerMessageId: result.providerMessageId,
          status: result.status,
        });
        await db
          .update(messageJobs)
          .set({ state: "sent", sentAt: new Date(), lastError: null, updatedAt: new Date() })
          .where(eq(messageJobs.id, job.id));
        stats.sent++;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await db.insert(messageDeliveries).values({ jobId: job.id, provider: provider.name, status: "error", error });
        if (job.attempts >= MAX_ATTEMPTS) {
          await db
            .update(messageJobs)
            .set({ state: "dead", lastError: error, updatedAt: new Date() })
            .where(eq(messageJobs.id, job.id));
          stats.dead++;
        } else {
          const minutes = BACKOFF_MINUTES[Math.min(job.attempts, MAX_ATTEMPTS) - 1] ?? 1;
          await db
            .update(messageJobs)
            .set({
              state: "failed",
              lastError: error,
              nextAttemptAt: new Date(Date.now() + minutes * 60_000),
              updatedAt: new Date(),
            })
            .where(eq(messageJobs.id, job.id));
          stats.retried++;
        }
      }
    }

    for (const messageId of touchedMessages) await refreshMessageStatus(messageId);
    return stats;
  } finally {
    g.__phDispatching = false;
  }
}

/** A message is "sent" once no job can still go out; "sending" while some have and some haven't. */
export async function refreshMessageStatus(messageId: string): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select({ state: messageJobs.state, n: sql<number>`count(*)::int` })
    .from(messageJobs)
    .where(eq(messageJobs.messageId, messageId))
    .groupBy(messageJobs.state);
  const count = (s: string) => rows.find((r) => r.state === s)?.n ?? 0;
  const open = count("queued") + count("failed") + count("sending");
  const sent = count("sent");
  const [msg] = await db.select({ status: messages.status }).from(messages).where(eq(messages.id, messageId));
  if (!msg || msg.status === "cancelled") return;
  const status = open === 0 ? "sent" : sent > 0 ? "sending" : "scheduled";
  if (status !== msg.status) {
    await db.update(messages).set({ status, updatedAt: new Date() }).where(eq(messages.id, messageId));
  }
}
