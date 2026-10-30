import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Event, EventInvite, Household } from "@/db/schema";
import { hashInviteToken } from "./tokens";

export type ResolvedInvite = {
  invite: EventInvite;
  event: Event;
  household: Household;
};

/**
 * The single authorization gate for guest routes: a token resolves to exactly
 * one live invite, which scopes everything the guest can see or change.
 */
export async function resolveInvite(token: string): Promise<ResolvedInvite | null> {
  if (!token || token.length > 128) return null;
  const db = await getDb();
  const rows = await db
    .select({ invite: schema.eventInvites, event: schema.events, household: schema.households })
    .from(schema.eventInvites)
    .innerJoin(schema.events, eq(schema.eventInvites.eventId, schema.events.id))
    .innerJoin(schema.households, eq(schema.eventInvites.householdId, schema.households.id))
    .where(eq(schema.eventInvites.tokenHash, hashInviteToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.invite.revokedAt) return null;
  if (row.invite.expiresAt && row.invite.expiresAt < new Date()) return null;
  if (row.event.status === "draft" || row.event.status === "archived") return null;
  return row;
}

export function guestCanRespond(event: Event, now = new Date()): boolean {
  if (event.status !== "invitations_open") return false;
  if (event.rsvpDeadline && event.rsvpDeadline < now) return false;
  return true;
}
