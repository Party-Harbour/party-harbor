import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Message, MessageJob } from "@/db/schema";

const { messages, messageJobs, messageDeliveries } = schema;

export type JobWithDeliveries = MessageJob & {
  deliveries: { provider: string; status: string; error: string | null; createdAt: Date }[];
};

export type MessageWithJobs = Message & {
  jobs: JobWithDeliveries[];
  counts: Record<MessageJob["state"], number>;
};

export async function listEventMessages(eventId: string): Promise<MessageWithJobs[]> {
  const db = await getDb();
  const msgs = await db.select().from(messages).where(eq(messages.eventId, eventId)).orderBy(desc(messages.scheduledAt));
  if (msgs.length === 0) return [];
  const jobs = await db
    .select()
    .from(messageJobs)
    .where(inArray(messageJobs.messageId, msgs.map((m) => m.id)))
    .orderBy(asc(messageJobs.recipientName));
  const deliveries = jobs.length
    ? await db
        .select()
        .from(messageDeliveries)
        .where(inArray(messageDeliveries.jobId, jobs.map((j) => j.id)))
        .orderBy(asc(messageDeliveries.createdAt))
    : [];

  return msgs.map((m) => {
    const mine = jobs
      .filter((j) => j.messageId === m.id)
      .map((j) => ({ ...j, deliveries: deliveries.filter((d) => d.jobId === j.id) }));
    const counts = { queued: 0, sending: 0, sent: 0, failed: 0, dead: 0, cancelled: 0, skipped: 0 };
    for (const j of mine) counts[j.state]++;
    return { ...m, jobs: mine, counts };
  });
}
