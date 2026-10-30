import { createHash, randomBytes } from "node:crypto";

// Guest invitation tokens: 256 bits of randomness, base64url encoded. Only the
// SHA-256 hash is stored, so a database leak does not expose working links.
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}
