import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** A pooler host looks like "aws-0-us-east-1.pooler.supabase.com". */
export function supabasePoolerHost(raw: string | undefined = process.env.SUPABASE_POOLER_HOST): string | null {
  const host = raw?.trim().toLowerCase() ?? "";
  return host.endsWith(".pooler.supabase.com") && !host.includes("/") && !host.includes(":") ? host : null;
}

/** True for Supabase's "Direct connection" string, which is IPv6-only and unreachable from most serverless hosts. */
export function isSupabaseDirectUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("db.") && host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

/**
 * Supabase's connect dialog shows the "Direct connection" string first, so it
 * is the one people paste. Given the project's pooler host, this rewrites it
 * into the "Transaction pooler" form: same password and database, user
 * "postgres.<ref>", port 6543. Anything else is returned untouched.
 */
export function viaSupabasePooler(url: string, poolerHost: string | null = supabasePoolerHost()): string {
  if (!poolerHost || !isSupabaseDirectUrl(url)) return url;
  const parsed = new URL(url);
  const ref = parsed.hostname.slice("db.".length, parsed.hostname.length - ".supabase.co".length);
  // `password` stays percent-encoded exactly as it was given.
  return `${parsed.protocol}//postgres.${ref}:${parsed.password}@${poolerHost}:6543${parsed.pathname}${parsed.search}`;
}

/** A database password given on its own, so nobody has to splice (and percent-encode) it into a URL by hand. */
export function databasePasswordOverride(): string | null {
  const value = process.env.SUPABASE_DB_PASSWORD ?? process.env.DATABASE_PASSWORD;
  return value && value.trim() ? value.trim() : null;
}

/** Replaces the password inside a connection string, encoding it so symbols such as @ # ? / survive. */
export function withPassword(url: string, password: string | null = databasePasswordOverride()): string {
  if (!password) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.host || !parsed.username) return url;
    return `${parsed.protocol}//${parsed.username}:${encodeURIComponent(password)}@${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** Set DATABASE_URL to run against a real Postgres (Supabase, Neon, self-hosted) instead of the embedded one. */
export function hostedDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url ? withPassword(viaSupabasePooler(url)) : null;
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
