/**
 * Capa PostgreSQL portable (Node.js y Deno/Supabase Edge Functions).
 * No depende de Next.js ni del sistema de archivos.
 */
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

export async function createPostgres(url: string, options: { poolSize?: number } = {}): Promise<Database> {
  const pg = await import("pg");
  const { Pool, types } = pg.default ?? pg;
  types.setTypeParser(OID_INT8, (v: string) => Number(v));
  types.setTypeParser(OID_DATE, (v: string) => v);
  types.setTypeParser(OID_NUMERIC, (v: string) => Number(v));
  const needsSsl = /sslmode=require/.test(url) || /supabase\.(co|com)/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: options.poolSize ?? 10,
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

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = error as { code?: string; constraint?: string; message?: string };
  if (e?.code !== "23505") return false;
  return constraint ? (e.constraint ?? e.message ?? "").includes(constraint) : true;
}

/* Proveedor de la conexión por defecto (lo registra cada entorno: Next.js o la Edge Function). */
let provider: (() => Promise<Database>) | null = null;

export function setDefaultDatabase(fn: () => Promise<Database>): void {
  provider = fn;
}

export function defaultDatabase(): Promise<Database> {
  if (!provider) throw new Error("No hay base de datos configurada.");
  return provider();
}
