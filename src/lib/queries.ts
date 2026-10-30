import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Contact, Event, EventInvite, Household, Rsvp } from "@/db/schema";

const {
  events,
  eventInvites,
  rsvps,
  tasks,
  households,
  contacts,
  contributionSlots,
  contributions,
  users,
} = schema;

export type EventSummary = Event & {
  invited: number;
  attending: number;
  maybe: number;
  declined: number;
  pending: number;
  headcount: number;
  openTasks: number;
  overdueTasks: number;
};

export async function listEventSummaries(): Promise<EventSummary[]> {
  const db = await getDb();
  const evs = await db.select().from(events).orderBy(asc(events.startsAt));
  if (evs.length === 0) return [];
  const ids = evs.map((e) => e.id);

  const inviteAgg = await db
    .select({ eventId: eventInvites.eventId, invited: sql<number>`count(*)::int` })
    .from(eventInvites)
    .where(and(inArray(eventInvites.eventId, ids), isNull(eventInvites.revokedAt)))
    .groupBy(eventInvites.eventId);

  const rsvpAgg = await db
    .select({
      eventId: rsvps.eventId,
      status: rsvps.status,
      n: sql<number>`count(*)::int`,
      heads: sql<number>`coalesce(sum(${rsvps.adults} + ${rsvps.children}), 0)::int`,
    })
    .from(rsvps)
    .innerJoin(eventInvites, eq(rsvps.inviteId, eventInvites.id))
    .where(and(inArray(rsvps.eventId, ids), isNull(eventInvites.revokedAt)))
    .groupBy(rsvps.eventId, rsvps.status);

  const taskAgg = await db
    .select({
      eventId: tasks.eventId,
      open: sql<number>`count(*)::int`,
      overdue: sql<number>`count(*) filter (where ${tasks.dueAt} < now())::int`,
    })
    .from(tasks)
    .where(and(inArray(tasks.eventId, ids), ne(tasks.status, "done")))
    .groupBy(tasks.eventId);

  return evs.map((e) => {
    const invited = inviteAgg.find((r) => r.eventId === e.id)?.invited ?? 0;
    const byStatus = (s: Rsvp["status"]) =>
      rsvpAgg.find((r) => r.eventId === e.id && r.status === s);
    const attending = byStatus("attending")?.n ?? 0;
    const maybe = byStatus("maybe")?.n ?? 0;
    const declined = byStatus("declined")?.n ?? 0;
    const headcount = byStatus("attending")?.heads ?? 0;
    const t = taskAgg.find((r) => r.eventId === e.id);
    return {
      ...e,
      invited,
      attending,
      maybe,
      declined,
      pending: Math.max(0, invited - attending - maybe - declined),
      headcount,
      openTasks: t?.open ?? 0,
      overdueTasks: t?.overdue ?? 0,
    };
  });
}

export async function getEvent(id: string): Promise<Event | null> {
  const db = await getDb();
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0] ?? null;
}

export type GuestRow = {
  invite: EventInvite;
  household: Household;
  rsvp: Rsvp | null;
  members: Contact[];
};

export async function getEventGuests(eventId: string): Promise<GuestRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ invite: eventInvites, household: households, rsvp: rsvps })
    .from(eventInvites)
    .innerJoin(households, eq(eventInvites.householdId, households.id))
    .leftJoin(rsvps, eq(rsvps.inviteId, eventInvites.id))
    .where(eq(eventInvites.eventId, eventId))
    .orderBy(asc(households.name));
  if (rows.length === 0) return [];
  const members = await db
    .select()
    .from(contacts)
    .where(inArray(contacts.householdId, rows.map((r) => r.household.id)))
    .orderBy(asc(contacts.isChild), asc(contacts.displayName));
  return rows.map((r) => ({
    ...r,
    members: members.filter((m) => m.householdId === r.household.id),
  }));
}

export type HouseholdWithContacts = Household & { members: Contact[] };

export async function listHouseholds(): Promise<HouseholdWithContacts[]> {
  const db = await getDb();
  const hh = await db.select().from(households).orderBy(asc(households.name));
  const members = await db
    .select()
    .from(contacts)
    .orderBy(asc(contacts.isChild), asc(contacts.displayName));
  return hh.map((h) => ({
    ...h,
    members: members.filter((m) => m.householdId === h.id),
  }));
}

export async function listHosts() {
  const db = await getDb();
  return db
    .select({ id: users.id, displayName: users.displayName, role: users.role })
    .from(users)
    .orderBy(asc(users.displayName));
}

export type TaskRow = typeof tasks.$inferSelect & { assigneeName: string | null };

export async function getEventTasks(eventId: string): Promise<TaskRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ task: tasks, assigneeName: users.displayName })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.eventId, eventId))
    .orderBy(asc(tasks.status), asc(tasks.dueAt));
  return rows.map((r) => ({ ...r.task, assigneeName: r.assigneeName }));
}

export type OpenTaskAcrossEvents = TaskRow & { eventTitle: string; eventTimezone: string };

export async function listOpenTasks(limit = 12): Promise<OpenTaskAcrossEvents[]> {
  const db = await getDb();
  const rows = await db
    .select({
      task: tasks,
      assigneeName: users.displayName,
      eventTitle: events.title,
      eventTimezone: events.timezone,
    })
    .from(tasks)
    .innerJoin(events, eq(tasks.eventId, events.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(ne(tasks.status, "done"), ne(events.status, "archived")))
    .orderBy(sql`${tasks.dueAt} asc nulls last`)
    .limit(limit);
  return rows.map((r) => ({
    ...r.task,
    assigneeName: r.assigneeName,
    eventTitle: r.eventTitle,
    eventTimezone: r.eventTimezone,
  }));
}

export type SlotWithClaims = typeof contributionSlots.$inferSelect & {
  claims: { id: string; description: string; quantity: number; householdName: string }[];
};

export async function getEventContributions(eventId: string): Promise<{
  slots: SlotWithClaims[];
  freeform: { id: string; description: string; quantity: number; householdName: string }[];
}> {
  const db = await getDb();
  const slots = await db
    .select()
    .from(contributionSlots)
    .where(eq(contributionSlots.eventId, eventId))
    .orderBy(asc(contributionSlots.sortOrder), asc(contributionSlots.createdAt));
  const claims = await db
    .select({
      id: contributions.id,
      slotId: contributions.slotId,
      description: contributions.description,
      quantity: contributions.quantity,
      householdName: households.name,
    })
    .from(contributions)
    .innerJoin(eventInvites, eq(contributions.inviteId, eventInvites.id))
    .innerJoin(households, eq(eventInvites.householdId, households.id))
    .where(eq(contributions.eventId, eventId))
    .orderBy(desc(contributions.createdAt));
  return {
    slots: slots.map((s) => ({
      ...s,
      claims: claims.filter((c) => c.slotId === s.id),
    })),
    freeform: claims.filter((c) => c.slotId === null),
  };
}
