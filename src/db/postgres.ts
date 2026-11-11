import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Set DATABASE_URL to run against a real Postgres (Supabase, Neon, self-hosted) instead of the embedded one. */
export function hostedDatabaseUrl(): string | null {
  return process.env.DATABASE_URL?.trim() || null;
}

function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Opens a postgres.js pool. Prepared statements are off so the same URL works
 * through a transaction-mode pooler (Supabase's port 6543), which is what a
 * serverless host should use. Kept free of "server-only" so scripts can use it.
 */
export function openPostgres(url: string, opts: { max?: number } = {}) {
  const client = postgres(url, {
    prepare: false,
    max: opts.max ?? (Number(process.env.DATABASE_POOL_MAX) || 5),
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: isLocalHost(url) ? false : "require",
    onnotice: () => {},
  });
  return { client, db: drizzle({ client, schema }) };
}
