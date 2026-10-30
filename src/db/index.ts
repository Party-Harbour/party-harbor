import "server-only";
import { rmSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

export type Db = PgliteDatabase<typeof schema>;

// One embedded Postgres per Node process. The promise lives on globalThis so
// Next.js hot reloads reuse it instead of opening the data directory twice
// (PGlite holds an exclusive lock on its data directory).
const globalRef = globalThis as unknown as { __partyHarborDb?: Promise<Db> };

async function init(): Promise<Db> {
  const dataDir = path.resolve(
    process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), "data", "pgdata"),
  );
  // A dev server killed mid-run leaves Postgres's lock file behind. This process
  // is the only one that opens the directory (see the global above), so clearing
  // a stale lock is safe. Never run two servers against the same directory.
  rmSync(path.join(dataDir, "postmaster.pid"), { force: true });
  const client = new PGlite(dataDir);
  await client.waitReady;
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seedIfEmpty(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalRef.__partyHarborDb) {
    globalRef.__partyHarborDb = init().catch((err) => {
      // Let the next request retry instead of caching a failed boot.
      globalRef.__partyHarborDb = undefined;
      throw err;
    });
  }
  return globalRef.__partyHarborDb;
}

export { schema };
