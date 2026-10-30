"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { EVENT_STATUSES, EVENT_THEMES, type Event } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { isValidTimeZone, wallToUtc } from "@/lib/dates";
import { optional, str, type ActionState } from "@/lib/action-state";

type EventValues = Pick<
  Event,
  | "title"
  | "description"
  | "startsAt"
  | "endsAt"
  | "timezone"
  | "venueName"
  | "venueAddress"
  | "rsvpDeadline"
  | "whatToBring"
  | "theme"
  | "coverImageUrl"
>;

function parseEventForm(formData: FormData): { values: EventValues } | { error: string } {
  const title = str(formData, "title");
  if (!title) return { error: "Give the event a title." };
  const timezone = str(formData, "timezone");
  if (!isValidTimeZone(timezone)) return { error: "Pick a valid time zone." };
  const startsAt = wallToUtc(str(formData, "startsAt"), timezone);
  if (!startsAt) return { error: "Set a start date and time." };
  const endsRaw = str(formData, "endsAt");
  const endsAt = endsRaw ? wallToUtc(endsRaw, timezone) : null;
  if (endsRaw && !endsAt) return { error: "The end time is not valid." };
  if (endsAt && endsAt <= startsAt) return { error: "The end time must be after the start." };
  const deadlineRaw = str(formData, "rsvpDeadline");
  const rsvpDeadline = deadlineRaw ? wallToUtc(deadlineRaw, timezone) : null;
  if (deadlineRaw && !rsvpDeadline) return { error: "The RSVP deadline is not valid." };
  const theme = str(formData, "theme") as Event["theme"];
  const coverImageUrl = optional(formData, "coverImageUrl");
  if (coverImageUrl && !/^https?:\/\//i.test(coverImageUrl)) {
    return { error: "The cover image must be a full http(s) link." };
  }

  return {
    values: {
      title,
      description: optional(formData, "description"),
      startsAt,
      endsAt,
      timezone,
      venueName: optional(formData, "venueName"),
      venueAddress: optional(formData, "venueAddress"),
      rsvpDeadline,
      whatToBring: optional(formData, "whatToBring"),
      theme: EVENT_THEMES.includes(theme) ? theme : "coastal",
      coverImageUrl,
    },
  };
}

function revalidateEvent(eventId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`, "layout");
}

export async function createEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireHost();
  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getDb();
  const [created] = await db
    .insert(schema.events)
    .values({ ...parsed.values, createdBy: host.id })
    .returning({ id: schema.events.id });
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId: created.id,
    action: "event.created",
    metadata: { title: parsed.values.title },
  });
  revalidateEvent(created.id);
  redirect(`/events/${created.id}`);
}

export async function updateEvent(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const host = await requireHost();
  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const status = str(formData, "status") as Event["status"];
  if (!EVENT_STATUSES.includes(status)) return { error: "Unknown event status." };

  const db = await getDb();
  const updated = await db
    .update(schema.events)
    .set({ ...parsed.values, status, updatedAt: new Date() })
    .where(eq(schema.events.id, eventId))
    .returning({ id: schema.events.id });
  if (updated.length === 0) return { error: "That event no longer exists." };
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId,
    action: "event.updated",
    metadata: { status },
  });
  revalidateEvent(eventId);
  redirect(`/events/${eventId}`);
}

export async function setEventStatus(formData: FormData): Promise<void> {
  const host = await requireHost();
  const eventId = str(formData, "eventId");
  const status = str(formData, "status") as Event["status"];
  if (!eventId || !EVENT_STATUSES.includes(status)) return;
  const db = await getDb();
  await db
    .update(schema.events)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.events.id, eventId));
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId,
    action: "event.status",
    metadata: { status },
  });
  revalidateEvent(eventId);
}
