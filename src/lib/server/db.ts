/**
 * Acceso a PostgreSQL.
 *  - Con DATABASE_URL: PostgreSQL real (Supabase, Neon, RDS, local…) mediante `pg`.
 *  - Sin DATABASE_URL: PostgreSQL embebido (PGlite) persistido en disco, para
 *    desarrollo local. Mismo SQL y mismas migraciones en ambos casos.
 */
import fs from "node:fs";
import path from "node:path";
import { createPostgres, setDefaultDatabase, type Database, type Queryable } from "./db-core";
import { serverEnv } from "./env";

export * from "./db-core";

async function createPglite(dataDir: string | null): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
  // Mismos conversores que en `pg`: bigint → number, date → texto, numeric → number.
  const parsers = {
    20: (v: string) => Number(v),
    1082: (v: string) => v,
    1700: (v: string) => Number(v),
  };
  const db = dataDir ? new PGlite(dataDir, { parsers }) : new PGlite({ parsers });
  await db.waitReady;
  type Tx = {
    query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; affectedRows?: number }>;
    exec: (sql: string) => Promise<unknown>;
  };
  const wrap = (q: Tx): Queryable => ({
    async query<T>(sql: string, params?: unknown[]) {
      const res = await q.query<T>(sql, params);
      // En PGlite `affectedRows` vale 0 en las consultas SELECT.
      return { rows: res.rows, rowCount: Math.max(res.affectedRows ?? 0, res.rows.length) };
    },
    async exec(sql: string) {
      await q.exec(sql);
    },
  });
  return {
    kind: "pglite",
    ...wrap(db as unknown as Tx),
    transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      return db.transaction((tx) => fn(wrap(tx as unknown as Tx)));
    },
    async close() {
      await db.close();
    },
  };
}

export function migrationsDir(): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "supabase", "migrations");
}

/** Aplica las migraciones pendientes (idempotente y seguro ante procesos concurrentes). */
export async function runMigrations(db: Database, dir = migrationsDir()): Promise<string[]> {
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const files = fs
    .readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied: string[] = [];
  for (const file of files) {
    const sql = fs.readFileSync(/*turbopackIgnore: true*/ path.join(dir, file), "utf8");
    const done = await db.transaction(async (tx) => {
      if (db.kind === "postgres") await tx.query("select pg_advisory_xact_lock(727274)");
      const exists = await tx.query("select 1 from schema_migrations where name = $1", [file]);
      if (exists.rowCount > 0) return false;
      await tx.exec(sql);
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
      return true;
    });
    if (done) applied.push(file);
  }
  return applied;
}

export async function openDatabase(
  options: { url?: string | null; pgliteDir?: string | null; migrate?: boolean } = {},
): Promise<Database> {
  const env = serverEnv();
  const url = options.url === undefined ? env.databaseUrl : options.url;
  const db = url
    ? await createPostgres(url, { poolSize: Number(process.env.DATABASE_POOL_SIZE ?? 10) })
    : await createPglite(options.pgliteDir === undefined ? env.pgliteDir : options.pgliteDir);
  if (options.migrate ?? process.env.AUTO_MIGRATE !== "false") await runMigrations(db);
  return db;
}

const globalForDb = globalThis as unknown as { __palabriaDb?: Promise<Database> };

/** Conexión compartida del proceso (también entre recargas en desarrollo). */
export function getDb(): Promise<Database> {
  globalForDb.__palabriaDb ??= openDatabase().catch((error: unknown) => {
    globalForDb.__palabriaDb = undefined;
    throw error;
  });
  return globalForDb.__palabriaDb;
}

/** Sustituye la conexión compartida (pruebas). */
export function setDbForTesting(db: Database | null): void {
  globalForDb.__palabriaDb = db ? Promise.resolve(db) : undefined;
}

setDefaultDatabase(getDb);
