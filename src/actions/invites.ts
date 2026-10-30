"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { RSVP_STATUSES, type Rsvp } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { generateInviteToken, hashInviteToken } from "@/lib/tokens";
import { int, str } from "@/lib/action-state";

export type InviteLink = { householdName: string; url: string };
export type InviteState = { error?: string; links?: InviteLink[] } | null;

function revalidateGuests(eventId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`, "layout");
}

/**
 * Creates (or re-issues, for a revoked row) one invite per selected household
 * and returns the raw links. Only the hash is stored, so this is the one
 * moment the links are visible; hosts can regenerate later.
 */
export async function generateInvites(
  eventId: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const host = await requireHost();
  const householdIds = formData
    .getAll("householdId")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  if (householdIds.length === 0) return { error: "Select at least one household." };

  const db = await getDb();
  const [event] = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.id, eventId));
  if (!event) return { error: "Event not found." };

  const hh = await db
    .select({ id: schema.households.id, name: schema.households.name })
    .from(schema.households)
    .where(inArray(schema.households.id, householdIds));

  const base = await getBaseUrl();
  const links: InviteLink[] = [];
  for (const h of hh) {
    const token = generateInviteToken();
    await db
      .insert(schema.eventInvites)
      .values({ eventId, householdId: h.id, tokenHash: hashInviteToken(token) })
      .onConflictDoUpdate({
        target: [schema.eventInvites.eventId, schema.eventInvites.householdId],
        set: { tokenHash: hashInviteToken(token), revokedAt: null, createdAt: new Date() },
      });
    links.push({ householdName: h.name, url: `${base}/e/${token}` });
  }
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId,
    action: "invite.generated",
    metadata: { households: hh.map((h) => h.id) },
  });
  revalidateGuests(eventId);
  return { links };
}

export async function regenerateInvite(inviteId: string): Promise<InviteState> {
  const host = await requireHost();
  const db = await getDb();
  const token = generateInviteToken();
  const [row] = await db
    .update(schema.eventInvites)
    .set({ tokenHash: hashInviteToken(token), revokedAt: null })
    .where(eq(schema.eventInvites.id, inviteId))
    .returning({ eventId: schema.eventInvites.eventId, householdId: schema.eventInvites.householdId });
  if (!row) return { error: "Invite not found." };
  const [h] = await db
    .select({ name: schema.households.name })
    .from(schema.households)
    .where(eq(schema.households.id, row.householdId));
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId: row.eventId,
    action: "invite.regenerated",
    metadata: { inviteId },
  });
  revalidateGuests(row.eventId);
  const base = await getBaseUrl();
  return { links: [{ householdName: h?.name ?? "Household", url: `${base}/e/${token}` }] };
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const host = await requireHost();
  const inviteId = str(formData, "inviteId");
  const eventId = str(formData, "eventId");
  if (!inviteId || !eventId) return;
  const db = await getDb();
  await db
    .update(schema.eventInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.eventInvites.id, inviteId), eq(schema.eventInvites.eventId, eventId)));
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId,
    action: "invite.revoked",
    metadata: { inviteId },
  });
  revalidateGuests(eventId);
}

/** Hosts can record a reply that arrived by phone or in person. */
export async function hostSetRsvp(formData: FormData): Promise<void> {
  const host = await requireHost();
  const inviteId = str(formData, "inviteId");
  const eventId = str(formData, "eventId");
  const status = str(formData, "status") as Rsvp["status"];
  if (!inviteId || !eventId || !RSVP_STATUSES.includes(status)) return;
  const adults = Math.max(0, int(formData, "adults"));
  const children = Math.max(0, int(formData, "children"));
  const db = await getDb();
  await db
    .insert(schema.rsvps)
    .values({ eventId, inviteId, status, adults, children, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.rsvps.inviteId,
      set: { status, adults, children, updatedAt: new Date() },
    });
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId,
    action: "rsvp.host_set",
    metadata: { inviteId, status, adults, children },
  });
  revalidateGuests(eventId);
}
