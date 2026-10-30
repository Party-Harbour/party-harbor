"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { RSVP_STATUSES, type Rsvp } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { inviteUrl, rotateInviteToken } from "@/lib/invite-links";
import { encryptToken } from "@/lib/messaging/crypto";
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
 * Creates (or re-issues, for a revoked row) one invite per selected household.
 * The hash is what guest requests are checked against; the encrypted copy lets
 * hosts copy or text the same link again later.
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
    const tokenHash = hashInviteToken(token);
    const tokenEnc = encryptToken(token);
    await db
      .insert(schema.eventInvites)
      .values({ eventId, householdId: h.id, tokenHash, tokenEnc })
      .onConflictDoUpdate({
        target: [schema.eventInvites.eventId, schema.eventInvites.householdId],
        set: { tokenHash, tokenEnc, revokedAt: null, createdAt: new Date() },
      });
    links.push({ householdName: h.name, url: inviteUrl(base, token) });
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
  const [row] = await db
    .select({
      eventId: schema.eventInvites.eventId,
      householdName: schema.households.name,
    })
    .from(schema.eventInvites)
    .innerJoin(schema.households, eq(schema.eventInvites.householdId, schema.households.id))
    .where(eq(schema.eventInvites.id, inviteId));
  if (!row) return { error: "Invite not found." };
  const token = await rotateInviteToken(inviteId);
  await db.insert(schema.auditLog).values({
    actor: host.email,
    eventId: row.eventId,
    action: "invite.regenerated",
    metadata: { inviteId },
  });
  revalidateGuests(row.eventId);
  const base = await getBaseUrl();
  return { links: [{ householdName: row.householdName, url: inviteUrl(base, token) }] };
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const host = await requireHost();
  const inviteId = str(formData, "inviteId");
  const eventId = str(formData, "eventId");
  if (!inviteId || !eventId) return;
  const db = await getDb();
  await db
    .update(schema.eventInvites)
    .set({ revokedAt: new Date(), tokenEnc: null })
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
