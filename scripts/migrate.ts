/**
 * Applies the SQL migrations in ./drizzle to the database in DATABASE_URL.
 * If SEED_HOST_PASSWORD is set and the database has no accounts, it also
 * creates the hosts listed in SEED_HOSTS; otherwise hosts sign up at /signup.
 *
 *   npm run db:migrate
 *
 * Runs automatically before each production build on Vercel (`vercel-build`).
 * The embedded local database does not need this: it migrates itself at startup.
 *
 * Every failure ends with one line starting "[db:migrate] failed:" that says
 * what to fix. Secrets are never printed.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { hostedDatabaseUrl, openPostgres } from "../src/db/postgres";
import { seedIfEmpty } from "../src/db/seed";

/** A problem the person deploying can fix by changing a setting. */
class SetupError extends Error {}

const WHERE = "In Vercel: Settings > Environments > Production > Environment Variables, then redeploy.";

/** Catches the usual copy-and-paste slips before trying to connect. */
function checkDatabaseUrl(url: string): void {
  if (url.includes("YOUR-PASSWORD")) {
    throw new SetupError(
      `DATABASE_URL still contains the [YOUR-PASSWORD] placeholder. Replace it, brackets included, with your database password. ${WHERE}`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SetupError(
      `DATABASE_URL is not a valid connection string. It should look like postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres. If the password has symbols such as @ : / ? # reset it to letters and digits in Supabase. ${WHERE}`,
    );
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new SetupError(`DATABASE_URL must start with postgresql:// but starts with ${parsed.protocol}// ${WHERE}`);
  }
  if (!parsed.password) {
    throw new SetupError(`DATABASE_URL has no password in it. It goes between the second colon and the @ sign. ${WHERE}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (host.startsWith("db.") && host.endsWith(".supabase.co")) {
    throw new SetupError(
      `DATABASE_URL is Supabase's "Direct connection" string, which Vercel cannot reach. In Supabase click Connect and copy the "Transaction pooler" string instead (it ends in :6543/postgres). ${WHERE}`,
    );
  }
  if (host.endsWith(".pooler.supabase.com") && parsed.port === "5432") {
    console.warn(
      '[db:migrate] Note: DATABASE_URL is the "Session pooler" string (port 5432). It works, but the "Transaction pooler" string (port 6543) suits Vercel better.',
    );
  }
}

/** Settings the app needs at run time; cheaper to hear about them now than from a broken page. */
function checkOtherSettings(): void {
  const key = process.env.INVITE_TOKEN_KEY?.trim() ?? "";
  const isHex64 = key.length === 64 && [...key.toLowerCase()].every((ch) => "0123456789abcdef".includes(ch));
  if (!isHex64) {
    throw new SetupError(
      `INVITE_TOKEN_KEY is ${key ? "not 64 hex characters" : "not set"}. It encrypts invitation links and the app cannot create them without it. ${WHERE}`,
    );
  }
  if (!(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim()) {
    console.warn("[db:migrate] Warning: SUPABASE_SECRET_KEY is not set, so photo uploads will fail until it is.");
  }
  if (!process.env.CRON_SECRET?.trim()) {
    console.warn("[db:migrate] Warning: CRON_SECRET is not set, so scheduled reminders and digests cannot be triggered.");
  }
}

/** Turns a driver error into something actionable, without echoing the connection string. */
function explain(err: unknown): string {
  if (err instanceof SetupError) return err.message;
  const chain: { code?: string; message?: string }[] = [];
  for (let e: unknown = err; e && chain.length < 4; e = (e as { cause?: unknown }).cause) {
    chain.push(e as { code?: string; message?: string });
  }
  const code = chain.map((e) => e.code).find(Boolean) ?? "";
  const text = chain.map((e) => e.message ?? "").join(" | ");
  if (code === "28P01" || /password authentication failed/i.test(text)) {
    return `The database rejected the password in DATABASE_URL. Reset it in Supabase (Database > Settings > Reset database password), put the new one in DATABASE_URL. ${WHERE}`;
  }
  if (/tenant(\/| or )user .*not found/i.test(text)) {
    return `Supabase does not recognise the project in DATABASE_URL. Copy the "Transaction pooler" string again from Supabase > Connect: the part after "postgres." and the region in the host must both match your project. ${WHERE}`;
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `The host name in DATABASE_URL does not exist. Copy the "Transaction pooler" string again from Supabase > Connect. ${WHERE}`;
  }
  if (code === "CONNECT_TIMEOUT" || code === "ETIMEDOUT" || code === "ECONNREFUSED") {
    return `Could not reach the database (${code}). Check the Supabase project is not paused, and that DATABASE_URL is the "Transaction pooler" string.`;
  }
  // Drizzle's message echoes query parameters (password hashes included), so keep only its first line.
  const first = (chain[0]?.message ?? String(err)).split(String.fromCharCode(10))[0].slice(0, 200);
  const cause = chain[1]?.message ? ` (${chain[1].message.slice(0, 200)})` : "";
  return `${first}${cause}${code ? ` [${code}]` : ""}`;
}

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });

  const onVercel = !!process.env.VERCEL;
  if (onVercel && process.env.VERCEL_ENV !== "production") {
    console.log("[db:migrate] Preview build: leaving the database alone.");
    return;
  }
  const url = hostedDatabaseUrl();
  if (!url) {
    if (onVercel) {
      const blank = process.env.DATABASE_URL !== undefined;
      throw new SetupError(
        `DATABASE_URL is ${blank ? "there but empty" : "not set"} for the Production environment. Paste the "Transaction pooler" connection string from Supabase > Connect as its value. ${WHERE}`,
      );
    }
    console.log("[db:migrate] No DATABASE_URL set. The embedded local database migrates itself when the app starts.");
    return;
  }
  checkDatabaseUrl(url);
  checkOtherSettings();

  const { client, db } = openPostgres(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("[db:migrate] Connected. Migrations are up to date.");
    if (process.env.SEED_HOST_PASSWORD) {
      const seeded = await seedIfEmpty(db, { samples: false });
      console.log(
        seeded === "skipped"
          ? "[db:migrate] Host accounts already exist; nothing seeded."
          : "[db:migrate] Seeded the host accounts from SEED_HOSTS.",
      );
    } else if (process.env.HOST_SIGNUP_CODE) {
      console.log("[db:migrate] No accounts seeded: hosts create their own at /signup with the sign-up code.");
    } else {
      console.warn(
        "[db:migrate] Nobody can sign in yet. Set HOST_SIGNUP_CODE so hosts can sign up, or SEED_HOST_PASSWORD to create accounts at deploy time.",
      );
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db:migrate] failed:", explain(err));
  process.exit(1);
});
