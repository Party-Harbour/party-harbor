import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Event, EventTemplate } from "@/db/schema";
import type { HostUser } from "@/lib/auth";
import { daysUntil, utcToWall, wallToUtc } from "@/lib/dates";
import { computeScheduledAt, enqueueMessage } from "@/lib/messaging/queue";
import { BUILTIN_TEMPLATES, getBuiltinTemplate } from "./builtin";
import { normalizeSnapshot, type RelativeMoment, type TemplateSnapshot } from "./types";

export { BUILTIN_TEMPLATES };
export * from "./types";

const { events, eventTemplates, contributionSlots, tasks, contests, contestCategories, messages, users } = schema;

/** Where a new event's plan comes from. The ref form is what the URL carries. */
export type TemplateSource = {
  ref: string;
  kind: "builtin" | "saved" | "event";
  name: string;
  snapshot: TemplateSnapshot;
};

function momentFrom(when: Date | null, start: Date, timezone: string): RelativeMoment | null {
  if (!when) return null;
  return { days: daysUntil(when, timezone, start), time: utcToWall(when, timezone).slice(11, 16) };
}

function momentTo(event: Pick<Event, "startsAt" | "timezone">, m: RelativeMoment): Date {
  return computeScheduledAt(event, { mode: "relative", days: m.days, time: m.time });
}

/** Captures an event's plan. Guest data is deliberately left out (PRD FR-11). */
export async function snapshotFromEvent(eventId: string): Promise<{ event: Event; snapshot: TemplateSnapshot } | null> {
  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) return null;
  const [slotRows, taskRows, contestRow, messageRows] = await Promise.all([
    db.select().from(contributionSlots).where(eq(contributionSlots.eventId, eventId)).orderBy(asc(contributionSlots.sortOrder), asc(contributionSlots.createdAt)),
    db.select().from(tasks).where(eq(tasks.eventId, eventId)).orderBy(asc(tasks.createdAt)),
    db.select().from(contests).where(eq(contests.eventId, eventId)).then((r) => r[0] ?? null),
    db
      .select()
      .from(messages)
      .where(and(eq(messages.eventId, eventId), ne(messages.status, "cancelled")))
      .orderBy(asc(messages.scheduledAt)),
  ]);
  const categories = contestRow
    ? await db.select().from(contestCategories).where(eq(contestCategories.contestId, contestRow.id)).orderBy(asc(contestCategories.sortOrder))
    : [];

  const snapshot: TemplateSnapshot = {
    version: 1,
    event: {
      title: event.title,
      description: event.description,
      timezone: event.timezone,
      durationMinutes: event.endsAt ? Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60000) : null,
      rsvpDeadline: momentFrom(event.rsvpDeadline, event.startsAt, event.timezone),
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      whatToBring: event.whatToBring,
      theme: event.theme,
      coverImageUrl: event.coverImageUrl,
      galleryPolicy: event.galleryPolicy,
      galleryAutoApprove: event.galleryAutoApprove,
    },
    slots: slotRows.map((s) => ({ category: s.category, title: s.title, capacity: s.capacity, notes: s.notes })),
    tasks: taskRows.map((t) => ({
      title: t.title,
      notes: t.notes,
      priority: t.priority,
      assigneeId: t.assigneeId,
      due: momentFrom(t.dueAt, event.startsAt, event.timezone),
    })),
    contest: contestRow
      ? {
          title: contestRow.title,
          entryNoun: contestRow.entryNoun,
          selfVotePolicy: contestRow.selfVotePolicy,
          voterEligibility: contestRow.voterEligibility,
          showBakers: contestRow.showBakers,
          categories: categories.map((c) => c.title),
        }
      : null,
    // Only messages tied to the event date travel; "send now" and fixed-time
    // ones belong to the original event.
    messages: messageRows
      .filter((m) => m.relativeDays !== null && m.relativeTime)
      .map((m) => ({ label: m.label, segment: m.segment, body: m.body, at: { days: m.relativeDays as number, time: m.relativeTime as string } })),
  };
  return { event, snapshot: normalizeSnapshot(snapshot) };
}

export async function listSavedTemplates(): Promise<(EventTemplate & { snapshot: TemplateSnapshot; sourceTitle: string | null })[]> {
  const db = await getDb();
  const rows = await db
    .select({ template: eventTemplates, sourceTitle: events.title })
    .from(eventTemplates)
    .leftJoin(events, eq(eventTemplates.sourceEventId, events.id))
    .orderBy(desc(eventTemplates.updatedAt));
  return rows.map((r) => ({ ...r.template, snapshot: normalizeSnapshot(r.template.snapshot), sourceTitle: r.sourceTitle }));
}

export async function getSavedTemplate(id: string): Promise<(EventTemplate & { snapshot: TemplateSnapshot }) | null> {
  const db = await getDb();
  const [row] = await db.select().from(eventTemplates).where(eq(eventTemplates.id, id));
  return row ? { ...row, snapshot: normalizeSnapshot(row.snapshot) } : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "builtin:cookie-exchange", "saved:<id>" or "event:<id>" → the plan behind it. */
export async function resolveTemplateRef(ref: string | undefined | null): Promise<TemplateSource | null> {
  if (!ref) return null;
  const [kind, key] = ref.split(":", 2);
  if (kind === "builtin") {
    const t = getBuiltinTemplate(key);
    return t ? { ref, kind, name: t.name, snapshot: t.snapshot } : null;
  }
  if (kind === "saved" && UUID_RE.test(key)) {
    const t = await getSavedTemplate(key);
    return t ? { ref, kind, name: t.name, snapshot: t.snapshot } : null;
  }
  if (kind === "event" && UUID_RE.test(key)) {
    const s = await snapshotFromEvent(key);
    return s ? { ref, kind, name: s.event.title, snapshot: s.snapshot } : null;
  }
  return null;
}

export type ApplyResult = { slots: number; tasks: number; contest: boolean; messages: number; pastMessages: number };

/**
 * Sets up a freshly created event from a snapshot. Relative moments are
 * resolved against the new start; messages whose send time has already
 * passed are skipped rather than queued into the past.
 */
export async function applySnapshot(input: { event: Event; snapshot: TemplateSnapshot; host: HostUser; baseUrl: string }): Promise<ApplyResult> {
  const db = await getDb();
  const { event, snapshot, host } = input;
  const result: ApplyResult = { slots: 0, tasks: 0, contest: false, messages: 0, pastMessages: 0 };

  if (snapshot.slots.length > 0) {
    await db.insert(contributionSlots).values(
      snapshot.slots.map((s, i) => ({ eventId: event.id, category: s.category, title: s.title, capacity: s.capacity, notes: s.notes, sortOrder: i })),
    );
    result.slots = snapshot.slots.length;
  }

  if (snapshot.tasks.length > 0) {
    // Assignees from the source event may have been removed since.
    const wanted = [...new Set(snapshot.tasks.map((t) => t.assigneeId).filter((id): id is string => !!id && UUID_RE.test(id)))];
    const known = wanted.length ? new Set((await db.select({ id: users.id }).from(users).where(inArray(users.id, wanted))).map((u) => u.id)) : new Set<string>();
    await db.insert(tasks).values(
      snapshot.tasks.map((t) => ({
        eventId: event.id,
        title: t.title,
        notes: t.notes,
        priority: t.priority,
        assigneeId: t.assigneeId && known.has(t.assigneeId) ? t.assigneeId : null,
        dueAt: t.due ? momentTo(event, t.due) : null,
      })),
    );
    result.tasks = snapshot.tasks.length;
  }

  if (snapshot.contest) {
    const { categories, ...settings } = snapshot.contest;
    const [created] = await db.insert(contests).values({ eventId: event.id, ...settings }).returning({ id: contests.id });
    if (categories.length > 0) {
      await db.insert(contestCategories).values(categories.map((title, i) => ({ contestId: created.id, title, sortOrder: i })));
    }
    result.contest = true;
  }

  const now = Date.now();
  for (const m of snapshot.messages) {
    if (momentTo(event, m.at).getTime() <= now) {
      result.pastMessages++;
      continue;
    }
    await enqueueMessage({
      event,
      hostName: host.displayName,
      hostEmail: host.email,
      createdBy: host.id,
      label: m.label,
      segment: m.segment,
      body: m.body,
      schedule: { mode: "relative", days: m.at.days, time: m.at.time },
      baseUrl: input.baseUrl,
    });
    result.messages++;
  }

  await db.insert(schema.auditLog).values({ actor: host.email, eventId: event.id, action: "template.applied", metadata: result });
  return result;
}

/**
 * Form defaults for the New event page when starting from a plan. Cloning an
 * event also suggests the same wall-clock time a year on, with the end and
 * RSVP deadline shifted to match; a template leaves the date for the host.
 */
export async function eventDefaultsFrom(source: TemplateSource): Promise<Partial<Event>> {
  const e = source.snapshot.event;
  const defaults: Partial<Event> = {
    title: e.title,
    description: e.description,
    timezone: e.timezone,
    venueName: e.venueName,
    venueAddress: e.venueAddress,
    whatToBring: e.whatToBring,
    theme: e.theme,
    coverImageUrl: e.coverImageUrl,
  };
  if (source.kind !== "event") return defaults;
  const db = await getDb();
  const [src] = await db.select().from(events).where(eq(events.id, source.ref.slice("event:".length)));
  if (!src) return defaults;
  const wall = utcToWall(src.startsAt, src.timezone);
  const startsAt = wallToUtc(`${Number(wall.slice(0, 4)) + 1}${wall.slice(4)}`, src.timezone);
  if (!startsAt) return defaults;
  const shifted = { ...defaults, startsAt } as Partial<Event>;
  if (e.durationMinutes) shifted.endsAt = new Date(startsAt.getTime() + e.durationMinutes * 60000);
  if (e.rsvpDeadline) shifted.rsvpDeadline = momentTo({ startsAt, timezone: src.timezone }, e.rsvpDeadline);
  return shifted;
}

/** End and RSVP deadline for a template-based event, derived from the chosen start. */
export function derivedTimes(snapshot: TemplateSnapshot, event: Pick<Event, "startsAt" | "timezone">): { endsAt: Date | null; rsvpDeadline: Date | null } {
  const e = snapshot.event;
  return {
    endsAt: e.durationMinutes ? new Date(event.startsAt.getTime() + e.durationMinutes * 60000) : null,
    rsvpDeadline: e.rsvpDeadline ? momentTo(event, e.rsvpDeadline) : null,
  };
}
