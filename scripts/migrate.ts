/**
 * Applies the SQL migrations in ./drizzle to the database in DATABASE_URL.
 * If SEED_HOST_PASSWORD is set and the database has no accounts, it also
 * creates the hosts listed in SEED_HOSTS; otherwise hosts sign up at /signup.
 *
 *   npm run db:migrate
 *
 * Runs automatically before each production build on Vercel (`vercel-build`).
 * The embedded local database does not need this: it migrates itself at startup.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { hostedDatabaseUrl, openPostgres } from "../src/db/postgres";
import { seedIfEmpty } from "../src/db/seed";

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });

  const onVercel = !!process.env.VERCEL;
  if (onVercel && process.env.VERCEL_ENV !== "production") {
    console.log("[db:migrate] Preview build: leaving the database alone.");
    return;
  }
  const url = hostedDatabaseUrl();
  if (!url) {
    if (onVercel) throw new Error("DATABASE_URL is not set. Add it to the Vercel project's environment variables.");
    console.log("[db:migrate] No DATABASE_URL set. The embedded local database migrates itself when the app starts.");
    return;
  }

  const { client, db } = openPostgres(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("[db:migrate] Migrations are up to date.");
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
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : null;
  // Drizzle's message echoes the query parameters (password hashes included), so keep only its first line.
  const message = err instanceof Error ? err.message.split(String.fromCharCode(10))[0].slice(0, 200) : String(err);
  console.error("[db:migrate] failed:", message, cause ? `(${cause})` : "");
  process.exit(1);
});
