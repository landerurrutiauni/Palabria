/**
 * Acceso a PostgreSQL.
 *  - Con DATABASE_URL: PostgreSQL real (Supabase, Neon, RDS, local…) mediante `pg`.
 *  - Sin DATABASE_URL: PostgreSQL embebido (PGlite) persistido en disco, para
 *    desarrollo local. Mismo SQL y mismas migraciones en ambos casos.
 */
import fs from "node:fs";
import path from "node:path";
import { serverEnv } from "./env";

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Ejecuta varias sentencias SQL sin parámetros. */
  exec(sql: string): Promise<void>;
}

export interface Database extends Queryable {
  readonly kind: "postgres" | "pglite";
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_NUMERIC = 1700;

async function createPostgres(url: string): Promise<Database> {
  const pg = await import("pg");
  const { Pool, types } = pg.default ?? pg;
  types.setTypeParser(OID_INT8, (v: string) => Number(v));
  types.setTypeParser(OID_DATE, (v: string) => v);
  types.setTypeParser(OID_NUMERIC, (v: string) => Number(v));
  const needsSsl = /sslmode=require/.test(url) || /supabase\.(co|com)/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  type Client = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> };
  const wrap = (client: Client): Queryable => ({
    async query<T>(sql: string, params?: unknown[]) {
      const res = await client.query(sql, params as unknown[]);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
    },
    async exec(sql: string) {
      await client.query(sql);
    },
  });
  const base = wrap(pool as unknown as Client);
  return {
    kind: "postgres",
    ...base,
    async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(wrap(client as unknown as Client));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

async function createPglite(dataDir: string | null): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
  const parsers = {
    [OID_INT8]: (v: string) => Number(v),
    [OID_DATE]: (v: string) => v,
    [OID_NUMERIC]: (v: string) => Number(v),
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
    ? await createPostgres(url)
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

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = error as { code?: string; constraint?: string; message?: string };
  if (e?.code !== "23505") return false;
  return constraint ? (e.constraint ?? e.message ?? "").includes(constraint) : true;
}
