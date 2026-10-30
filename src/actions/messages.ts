"use server";

import { revalidatePath } from "next/cache";
import { MESSAGE_SEGMENTS } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { wallToUtc } from "@/lib/dates";
import { runDueJobs } from "@/lib/messaging/dispatcher";
import { cancelMessage, enqueueMessage, retryJob, type Schedule } from "@/lib/messaging/queue";
import type { MessageSegmentValue } from "@/lib/messaging/types";
import { getEvent } from "@/lib/queries";
import { int, str, type ActionState } from "@/lib/action-state";

function revalidateMessages(eventId: string) {
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/events", "layout");
}

export async function createMessage(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const host = await requireHost();
  const event = await getEvent(eventId);
  if (!event) return { error: "Event not found." };

  const body = str(formData, "body");
  if (!body) return { error: "Write the message first." };
  if (body.length > 1000) return { error: "Keep it under 1000 characters (that's already several texts)." };
  const label = str(formData, "label") || body.slice(0, 40);
  const segment = str(formData, "segment") as MessageSegmentValue;
  if (!MESSAGE_SEGMENTS.includes(segment)) return { error: "Pick who should get it." };

  const mode = str(formData, "scheduleMode");
  let schedule: Schedule;
  if (mode === "at") {
    const at = wallToUtc(str(formData, "at"), event.timezone);
    if (!at) return { error: "Set a date and time to send." };
    if (at.getTime() < Date.now() - 60_000) return { error: "That time has already passed." };
    schedule = { mode: "at", at };
  } else if (mode === "relative") {
    const days = int(formData, "relativeDays", NaN);
    const time = str(formData, "relativeTime");
    if (!Number.isFinite(days) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Set the day offset and time." };
    schedule = { mode: "relative", days, time };
  } else {
    schedule = { mode: "now" };
  }

  const result = await enqueueMessage({
    event,
    hostName: host.displayName,
    hostEmail: host.email,
    createdBy: host.id,
    label,
    segment,
    body,
    schedule,
    baseUrl: await getBaseUrl(),
  });

  let sentNow = 0;
  if (schedule.mode === "now" && !result.deferred && result.queued > 0) {
    sentNow = (await runDueJobs()).sent;
  }
  revalidateMessages(eventId);

  const parts = [
    result.queued === 0 ? "No one is eligible to receive this" : `${result.queued} queued`,
    result.skipped ? `${result.skipped} skipped (no phone or no consent)` : null,
    sentNow ? `${sentNow} sent` : null,
    result.deferred ? "held until 8:00 because of quiet hours" : null,
  ].filter(Boolean);
  return { ok: true, message: parts.join(" · ") + "." };
}

export async function cancelMessageAction(formData: FormData): Promise<void> {
  const host = await requireHost();
  const messageId = str(formData, "messageId");
  const eventId = str(formData, "eventId");
  if (!messageId || !eventId) return;
  await cancelMessage(messageId, eventId, host.email);
  revalidateMessages(eventId);
}

export async function retryJobAction(formData: FormData): Promise<void> {
  await requireHost();
  const jobId = str(formData, "jobId");
  const eventId = str(formData, "eventId");
  if (!jobId || !eventId) return;
  await retryJob(jobId, eventId);
  await runDueJobs();
  revalidateMessages(eventId);
}

export async function runQueueNow(formData: FormData): Promise<void> {
  await requireHost();
  const eventId = str(formData, "eventId");
  await runDueJobs();
  if (eventId) revalidateMessages(eventId);
}
