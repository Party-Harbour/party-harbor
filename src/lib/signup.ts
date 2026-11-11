import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Host sign-up is gated by a shared code. Every host sees every event and
 * every guest's details, so an open sign-up page on the public internet would
 * hand the address book to anyone who found it. Set HOST_SIGNUP_CODE (8+
 * characters) to open the page for people you give the code to; remove it to
 * close sign-up again.
 */
function signupCode(): string | null {
  // HOST_SIGNUP is accepted too: it is an easy slip when typing the name by hand.
  const code = (process.env.HOST_SIGNUP_CODE ?? process.env.HOST_SIGNUP)?.trim();
  return code && code.length >= 8 ? code : null;
}

export function signupOpen(): boolean {
  return signupCode() !== null;
}

/** Constant-time comparison (on digests, so lengths never leak either). */
export function signupCodeMatches(candidate: string): boolean {
  const code = signupCode();
  if (!code) return false;
  const a = createHash("sha256").update(candidate.trim()).digest();
  const b = createHash("sha256").update(code).digest();
  return timingSafeEqual(a, b);
}

export const MIN_PASSWORD_LENGTH = 10;
