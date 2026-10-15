/**
 * Supabase Edge Function «api» (Deno). Se empaqueta con esbuild en
 * `supabase/functions/api/server.js` (ver scripts/build-edge.mjs).
 *
 *  - Identidad: sesión anónima de Supabase Auth; el JWT se verifica con
 *    `auth.getClaims()` y el `sub` identifica al jugador.
 *  - Base de datos: conexión directa a Postgres (SUPABASE_DB_URL) con las
 *    mismas transacciones y bloqueos que el servidor Node.js.
 *  - Tiempo real: tras cada cambio de una sala se envía un aviso (Broadcast)
 *    al canal `room-<código>`; los navegadores releen su vista.
 */
import { createClient } from "@supabase/supabase-js";
import { bearerToken, createApiHandler } from "@/lib/server/api-handler";
import { createPostgres, setDefaultDatabase, type Database } from "@/lib/server/db-core";
import { playerFromAuthUser } from "@/lib/server/players";
import { setRoomPublisher } from "@/lib/server/realtime";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export function startEdgeServer(): void {
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth;

  let dbPromise: Promise<Database> | null = null;
  const getDb = () => (dbPromise ??= createPostgres(env("SUPABASE_DB_URL"), { poolSize: 3 }));
  setDefaultDatabase(getDb);

  if (serviceKey) {
    setRoomPublisher(async (room) => {
      const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ topic: `room-${room.code}`, event: "update", payload: { at: Date.now() } }],
        }),
        signal: AbortSignal.timeout(2_000),
      });
      if (!res.ok) throw new Error(`Broadcast ${res.status}`);
    });
  }

  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").trim();
  const handler = createApiHandler({
    getDb,
    allowedOrigins: allowed === "*" ? "*" : allowed.split(",").map((o) => o.trim()),
    background: (task) => {
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
    },
    authenticate: async (request, db) => {
      const token = bearerToken(request);
      if (!token) return null;
      const { data, error } = await auth.getClaims(token);
      const sub = data?.claims?.sub;
      if (error || typeof sub !== "string") return null;
      return playerFromAuthUser(db, sub);
    },
  });

  Deno.serve(handler);
}
