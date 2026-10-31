import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Contact, Event, EventInvite, Household, Message, Rsvp } from "@/db/schema";
import { formatDate, formatTime, utcToWall, wallToUtc } from "@/lib/dates";
import { ensureInviteToken, inviteUrl } from "@/lib/invite-links";
import { renderTemplate, usesLink } from "./templates";
import type { MessageSegmentValue } from "./types";

const { messages, messageJobs, eventInvites, households, contacts, rsvps } = schema;

export const QUIET_HOURS = { start: 21, end: 8 } as const;

export type Schedule =
  | { mode: "now" }
  | { mode: "at"; at: Date }
  | { mode: "relative"; days: number; time: string };

/** The instant a message should go out, before quiet-hours adjustment. */
export function computeScheduledAt(event: Pick<Event, "startsAt" | "timezone">, schedule: Schedule, now = new Date()): Date {
  if (schedule.mode === "now") return now;
  if (schedule.mode === "at") return schedule.at;
  const eventDay = utcToWall(event.startsAt, event.timezone).slice(0, 10);
  const [y, m, d] = eventDay.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + schedule.days));
  const wall = `${target.toISOString().slice(0, 10)}T${schedule.time}`;
  return wallToUtc(wall, event.timezone) ?? now;
}

/** Nothing goes out between 21:00 and 08:00 in the event's time zone; it waits for 08:00. */
export function applyQuietHours(when: Date, timeZone: string): { at: Date; deferred: boolean } {
  const wall = utcToWall(when, timeZone);
  const hour = Number(wall.slice(11, 13));
  if (hour >= QUIET_HOURS.end && hour < QUIET_HOURS.start) return { at: when, deferred: false };
  const day = wall.slice(0, 10);
  let targetDay = day;
  if (hour >= QUIET_HOURS.start) {
    const [y, m, d] = day.split("-").map(Number);
    targetDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  }
  const at = wallToUtc(`${targetDay}T${String(QUIET_HOURS.end).padStart(2, "0")}:00`, timeZone) ?? when;
  return { at, deferred: true };
}

export type Recipient = {
  contact: Contact;
  household: Household;
  invite: EventInvite;
  rsvp: Rsvp | null;
};

/** Adults in actively invited households, filtered by the segment's RSVP rule. */
export async function resolveRecipients(eventId: string, segment: MessageSegmentValue): Promise<Recipient[]> {
  const db = await getDb();
  const rows = await db
    .select({ contact: contacts, household: households, invite: eventInvites, rsvp: rsvps })
    .from(eventInvites)
    .innerJoin(households, eq(eventInvites.householdId, households.id))
    .innerJoin(contacts, eq(contacts.householdId, households.id))
    .leftJoin(rsvps, eq(rsvps.inviteId, eventInvites.id))
    .where(and(eq(eventInvites.eventId, eventId), isNull(eventInvites.revokedAt), eq(contacts.isChild, false)))
    .orderBy(asc(households.name), asc(contacts.displayName));

  return rows.filter((r) => {
    const status = r.rsvp?.status ?? "pending";
    switch (segment) {
      case "all_invited":
        return true;
      case "pending_rsvp":
        return status === "pending";
      case "attending":
        return status === "attending";
      case "not_declined":
        return status !== "declined";
    }
  });
}

export type Reach = { eligible: number; noPhone: number; noConsent: number; optedOut: number };

export function summarizeReach(recipients: Recipient[]): Reach {
  const reach: Reach = { eligible: 0, noPhone: 0, noConsent: 0, optedOut: 0 };
  for (const r of recipients) {
    if (!r.contact.phoneE164) reach.noPhone++;
    else if (r.contact.consentState === "opted_out") reach.optedOut++;
    else if (r.contact.consentState !== "opted_in") reach.noConsent++;
    else reach.eligible++;
  }
  return reach;
}

function skipReasonFor(contact: Contact): string | null {
  if (!contact.phoneE164) return "No mobile number";
  if (contact.consentState === "opted_out") return "Opted out of messages";
  if (contact.consentState !== "opted_in") return "No messaging consent recorded";
  return null;
}

export async function enqueueMessage(input: {
  event: Event;
  hostName: string;
  hostEmail: string;
  createdBy: string;
  label: string;
  segment: MessageSegmentValue;
  body: string;
  schedule: Schedule;
  baseUrl: string;
}): Promise<{ message: Message; queued: number; skipped: number; deferred: boolean }> {
  const db = await getDb();
  const { event } = input;
  const raw = computeScheduledAt(event, input.schedule);
  const { at: scheduledAt, deferred } = applyQuietHours(raw, event.timezone);

  const [message] = await db
    .insert(messages)
    .values({
      eventId: event.id,
      createdBy: input.createdBy,
      label: input.label,
      segment: input.segment,
      body: input.body,
      scheduledAt,
      relativeDays: input.schedule.mode === "relative" ? input.schedule.days : null,
      relativeTime: input.schedule.mode === "relative" ? input.schedule.time : null,
    })
    .returning();

  const recipients = await resolveRecipients(event.id, input.segment);
  const { queued, skipped } = await createJobs({ event, message, hostName: input.hostName, baseUrl: input.baseUrl }, recipients);

  // Nothing to do and no one still to come: done. A future message with no
  // recipients yet stays scheduled so households invited later get a job
  // (see backfillJobsForInvites); that's how a template's reminders work on
  // an event that has no guests on day one.
  if (queued === 0 && scheduledAt.getTime() <= Date.now()) {
    await db.update(messages).set({ status: "sent", updatedAt: new Date() }).where(eq(messages.id, message.id));
  }
  await db.insert(schema.auditLog).values({
    actor: input.hostEmail,
    eventId: event.id,
    action: "message.queued",
    metadata: { messageId: message.id, label: input.label, segment: input.segment, queued, skipped, scheduledAt, deferred },
  });
  return { message, queued, skipped, deferred };
}

type JobContext = { event: Event; message: Message; hostName: string; baseUrl: string };

/** One job per recipient, rendered for them. Idempotent on (message, contact). */
async function createJobs(ctx: JobContext, recipients: Recipient[]): Promise<{ queued: number; skipped: number }> {
  const db = await getDb();
  const { event, message } = ctx;
  const needsLink = usesLink(message.body);
  // One token per household, however many adults it has.
  const tokenByInvite = new Map<string, string>();
  const linkFor = async (inviteId: string) => {
    let token = tokenByInvite.get(inviteId);
    if (!token) {
      token = await ensureInviteToken({ id: inviteId });
      tokenByInvite.set(inviteId, token);
    }
    return inviteUrl(ctx.baseUrl, token);
  };
  let queued = 0;
  let skipped = 0;
  for (const r of recipients) {
    const skipReason = skipReasonFor(r.contact);
    const link = needsLink && !skipReason ? await linkFor(r.invite.id) : "";
    const body = renderTemplate(message.body, {
      first_name: r.contact.displayName.split(/\s+/)[0] ?? r.contact.displayName,
      household: r.household.name,
      event: event.title,
      date: formatDate(event.startsAt, event.timezone),
      time: formatTime(event.startsAt, event.timezone),
      venue: event.venueName ?? "",
      link,
      host: ctx.hostName,
    });
    const inserted = await db
      .insert(messageJobs)
      .values({
        messageId: message.id,
        eventId: event.id,
        contactId: r.contact.id,
        inviteId: r.invite.id,
        recipientName: `${r.contact.displayName} (${r.household.name})`,
        toPhone: r.contact.phoneE164,
        body,
        scheduledAt: message.scheduledAt,
        nextAttemptAt: message.scheduledAt,
        state: skipReason ? "skipped" : "queued",
        skipReason,
        idempotencyKey: `${message.id}:${r.contact.id}`,
      })
      .onConflictDoNothing({ target: messageJobs.idempotencyKey })
      .returning({ id: messageJobs.id });
    if (inserted.length === 0) continue;
    if (skipReason) skipped++;
    else queued++;
  }
  return { queued, skipped };
}

/**
 * Households invited after a message was scheduled still get it, as long as
 * it hasn't gone out yet and their RSVP state fits the segment.
 */
export async function backfillJobsForInvites(input: {
  event: Event;
  inviteIds: string[];
  hostName: string;
  hostEmail: string;
  baseUrl: string;
}): Promise<number> {
  if (input.inviteIds.length === 0) return 0;
  const db = await getDb();
  const wanted = new Set(input.inviteIds);
  const pending = await db
    .select()
    .from(messages)
    .where(and(eq(messages.eventId, input.event.id), eq(messages.status, "scheduled")));
  let added = 0;
  for (const message of pending) {
    if (message.scheduledAt.getTime() <= Date.now()) continue;
    const recipients = (await resolveRecipients(input.event.id, message.segment)).filter((r) => wanted.has(r.invite.id));
    const { queued } = await createJobs({ event: input.event, message, hostName: input.hostName, baseUrl: input.baseUrl }, recipients);
    added += queued;
  }
  if (added > 0) {
    await db.insert(schema.auditLog).values({
      actor: input.hostEmail,
      eventId: input.event.id,
      action: "message.backfilled",
      metadata: { invites: input.inviteIds, jobs: added },
    });
  }
  return added;
}

export async function cancelMessage(messageId: string, eventId: string, actor: string): Promise<void> {
  const db = await getDb();
  const [msg] = await db
    .update(messages)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(messages.id, messageId), eq(messages.eventId, eventId), inArray(messages.status, ["scheduled", "sending"])))
    .returning({ id: messages.id });
  if (!msg) return;
  await db
    .update(messageJobs)
    .set({ state: "cancelled", updatedAt: new Date() })
    .where(and(eq(messageJobs.messageId, messageId), inArray(messageJobs.state, ["queued", "failed"])));
  await db.insert(schema.auditLog).values({ actor, eventId, action: "message.cancelled", metadata: { messageId } });
}

/** When an event's start moves, messages scheduled relative to it move too (PRD section 12). */
export async function rescheduleRelativeMessages(event: Event, actor: string): Promise<number> {
  const db = await getDb();
  const pending = await db
    .select()
    .from(messages)
    .where(and(eq(messages.eventId, event.id), eq(messages.status, "scheduled")));
  let moved = 0;
  for (const m of pending) {
    if (m.relativeDays === null || !m.relativeTime) continue;
    const raw = computeScheduledAt(event, { mode: "relative", days: m.relativeDays, time: m.relativeTime });
    const { at } = applyQuietHours(raw, event.timezone);
    if (at.getTime() === m.scheduledAt.getTime()) continue;
    await db.update(messages).set({ scheduledAt: at, updatedAt: new Date() }).where(eq(messages.id, m.id));
    await db
      .update(messageJobs)
      .set({ scheduledAt: at, nextAttemptAt: at, updatedAt: new Date() })
      .where(and(eq(messageJobs.messageId, m.id), inArray(messageJobs.state, ["queued", "failed"])));
    moved++;
  }
  if (moved > 0) {
    await db.insert(schema.auditLog).values({
      actor,
      eventId: event.id,
      action: "message.rescheduled",
      metadata: { moved, startsAt: event.startsAt },
    });
  }
  return moved;
}

export async function retryJob(jobId: string, eventId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(messageJobs)
    .set({ state: "queued", attempts: 0, nextAttemptAt: new Date(), lastError: null, updatedAt: new Date() })
    .where(and(eq(messageJobs.id, jobId), eq(messageJobs.eventId, eventId), inArray(messageJobs.state, ["dead", "failed"])));
  await db
    .update(messages)
    .set({ status: "scheduled", updatedAt: new Date() })
    .where(
      and(
        eq(messages.eventId, eventId),
        inArray(messages.id, db.select({ id: messageJobs.messageId }).from(messageJobs).where(eq(messageJobs.id, jobId))),
      ),
    );
}
