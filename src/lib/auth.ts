import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { generateSessionId } from "./tokens";

export const SESSION_COOKIE = "ph_session";
const SESSION_DAYS = 30;

export type HostUser = {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "cohost";
  timezone: string;
};

export async function getCurrentHost(): Promise<HostUser | null> {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      role: schema.users.role,
      timezone: schema.users.timezone,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, sid), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

/** For host pages and actions: redirects to /login when no valid session. */
export async function requireHost(): Promise<HostUser> {
  const host = await getCurrentHost();
  if (!host) redirect("/login");
  return host;
}

export async function createSession(userId: string): Promise<void> {
  const db = await getDb();
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(schema.sessions).values({ id, userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (sid) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sid));
  }
  store.delete(SESSION_COOKIE);
}
