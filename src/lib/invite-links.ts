import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { EventInvite } from "@/db/schema";
import { decryptToken, encryptToken } from "./messaging/crypto";
import { generateInviteToken, hashInviteToken } from "./tokens";

/** Issues a fresh token for an invite, storing its hash and an encrypted copy. */
export async function rotateInviteToken(inviteId: string): Promise<string> {
  const db = await getDb();
  const token = generateInviteToken();
  await db
    .update(schema.eventInvites)
    .set({ tokenHash: hashInviteToken(token), tokenEnc: encryptToken(token), revokedAt: null })
    .where(eq(schema.eventInvites.id, inviteId));
  return token;
}

/**
 * The raw token for an invite, rotating it only if no resendable copy exists.
 * Always re-reads the row so several recipients of one household (or two
 * concurrent sends) share a single token instead of rotating each other out.
 */
export async function ensureInviteToken(invite: Pick<EventInvite, "id">): Promise<string> {
  const db = await getDb();
  const [fresh] = await db
    .select({ tokenEnc: schema.eventInvites.tokenEnc })
    .from(schema.eventInvites)
    .where(eq(schema.eventInvites.id, invite.id));
  if (fresh?.tokenEnc) {
    const token = decryptToken(fresh.tokenEnc);
    if (token) return token;
  }
  return rotateInviteToken(invite.id);
}

/** Read-only: the link for an invite if a resendable token is stored, else null. */
export function storedInviteToken(invite: Pick<EventInvite, "tokenEnc">): string | null {
  return invite.tokenEnc ? decryptToken(invite.tokenEnc) : null;
}

export function inviteUrl(base: string, token: string): string {
  return `${base}/e/${token}`;
}
