import "server-only";
import { rmSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { hostedDatabaseUrl } from "./postgres";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

/** Driver-agnostic handle: the embedded PGlite locally, postgres.js when DATABASE_URL is set. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// One database handle per Node process. The promise lives on globalThis so
// Next.js hot reloads reuse it instead of opening the data directory twice
// (PGlite holds an exclusive lock on its data directory) or leaking pools.
const globalRef = globalThis as unknown as { __partyHarborDb?: Promise<Db> };

/**
 * Hosted: connect and nothing else. Migrations and the first-run seed are a
 * deploy step (`npm run db:migrate`), so concurrent cold starts never race to
 * apply the same migration.
 */
async function initHosted(url: string): Promise<Db> {
  const { openPostgres } = await import("./postgres");
  return openPostgres(url).db;
}

/** Local: an embedded Postgres that migrates and seeds itself on first use. */
async function initEmbedded(): Promise<Db> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const dataDir = path.resolve(
    /*turbopackIgnore: true*/ process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), "data", "pgdata"),
  );
  // A dev server killed mid-run leaves Postgres's lock file behind. This process
  // is the only one that opens the directory (see the global above), so clearing
  // a stale lock is safe. Never run two servers against the same directory.
  rmSync(path.join(dataDir, "postmaster.pid"), { force: true });
  const client = new PGlite(dataDir);
  await client.waitReady;
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seedIfEmpty(db, { samples: true });
  return db;
}

export function isHostedDatabase(): boolean {
  return hostedDatabaseUrl() !== null;
}

export function getDb(): Promise<Db> {
  if (!globalRef.__partyHarborDb) {
    const url = hostedDatabaseUrl();
    globalRef.__partyHarborDb = (url ? initHosted(url) : initEmbedded()).catch((err) => {
      // Let the next request retry instead of caching a failed boot.
      globalRef.__partyHarborDb = undefined;
      throw err;
    });
  }
  return globalRef.__partyHarborDb;
}

export { schema };
