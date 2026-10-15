/**
 * Variante de prueba de la Edge Function para ejecutarla en Deno sin Supabase:
 * misma API y mismo código de juego, con autenticación de desarrollo (dev.<uuid>)
 * y la base de datos indicada en DATABASE_URL. Solo para pruebas locales.
 */
import { createApiHandler } from "@/lib/server/api-handler";
import { createPostgres, setDefaultDatabase, type Database } from "@/lib/server/db-core";
import { devAuthenticate } from "@/lib/server/dev-auth";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(options: { port: number }, handler: (request: Request) => Response | Promise<Response>): unknown;
};

export function startDevEdgeServer(): void {
  let dbPromise: Promise<Database> | null = null;
  const getDb = () => (dbPromise ??= createPostgres(Deno.env.get("DATABASE_URL")!, { poolSize: 3 }));
  setDefaultDatabase(getDb);
  const handler = createApiHandler({ getDb, authenticate: devAuthenticate, allowedOrigins: "*" });
  Deno.serve({ port: Number(Deno.env.get("PORT") ?? 3400) }, handler);
}
