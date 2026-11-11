"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { createSession, destroySession } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/dates";
import { hashPassword, verifyPassword } from "@/lib/password";
import { MIN_PASSWORD_LENGTH, signupCodeMatches, signupOpen } from "@/lib/signup";
import { str, type ActionState } from "@/lib/action-state";

const WINDOW_MS = 15 * 60 * 1000;
/** Wrong passwords allowed per account inside the window before sign-in pauses. */
const MAX_SIGNIN_FAILURES = 8;
/** Wrong sign-up codes allowed (from anyone) inside the window before sign-up pauses. */
const MAX_SIGNUP_FAILURES = 10;

/** Failed attempts are audit-log rows; this counts the recent ones for a throttle. */
async function recentFailures(action: string, actor: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.action, action),
        eq(schema.auditLog.actor, actor),
        gt(schema.auditLog.createdAt, new Date(Date.now() - WINDOW_MS)),
      ),
    );
  return row?.n ?? 0;
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!email || typeof password !== "string" || !password) return { error: "Enter your email and password." };

  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  // Unknown emails get the same answer and leave no trace, so the log can't be
  // flooded and the reply never reveals which addresses have accounts.
  if (!user) return { error: "That email and password combination did not match." };

  if ((await recentFailures("auth.signin_failed", user.email)) >= MAX_SIGNIN_FAILURES) {
    return { error: "Too many wrong passwords for this account. Wait 15 minutes and try again." };
  }
  if (!verifyPassword(password, user.passwordHash)) {
    await db.insert(schema.auditLog).values({ actor: user.email, action: "auth.signin_failed" });
    return { error: "That email and password combination did not match." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!signupOpen()) return { error: "Sign-up is closed. Ask the person who runs this Party Harbor to open it." };

  const displayName = str(formData, "displayName");
  const email = str(formData, "email").toLowerCase();
  const password = formData.get("password");
  const passwordAgain = formData.get("passwordAgain");
  const code = str(formData, "code");
  const zone = str(formData, "timezone");

  if (!displayName || displayName.length > 40) return { error: "Enter your name (up to 40 characters)." };
  const at = email.indexOf("@");
  if (at < 1 || at === email.length - 1 || email.includes(" ") || email.length > 254) {
    return { error: "Enter a valid email address." };
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > 200) return { error: "That password is too long." };
  if (password !== passwordAgain) return { error: "The two passwords don't match." };
  if (!code) return { error: "Enter the sign-up code." };

  const db = await getDb();
  if ((await recentFailures("auth.signup_denied", "signup")) >= MAX_SIGNUP_FAILURES) {
    return { error: "Too many wrong sign-up codes. Wait 15 minutes and try again." };
  }
  if (!signupCodeMatches(code)) {
    await db.insert(schema.auditLog).values({ actor: "signup", action: "auth.signup_denied" });
    return { error: "That sign-up code isn't right." };
  }

  const [user] = await db
    .insert(schema.users)
    .values({
      email,
      displayName,
      passwordHash: hashPassword(password),
      role: "owner",
      ...(zone && isValidTimeZone(zone) ? { timezone: zone } : {}),
    })
    .onConflictDoNothing({ target: schema.users.email })
    .returning({ id: schema.users.id });
  if (!user) return { error: "There's already an account with that email. Sign in instead." };

  await db.insert(schema.auditLog).values({ actor: email, action: "auth.signup", metadata: { displayName } });
  await createSession(user.id);
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
