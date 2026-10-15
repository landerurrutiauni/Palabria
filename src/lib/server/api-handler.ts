/**
 * API del juego independiente del entorno (Web `Request` → `Response`).
 *
 * La usa la Supabase Edge Function de la versión GitHub Pages + Supabase y el
 * servidor de desarrollo `scripts/api-server.ts`. Expone las mismas rutas que
 * la API de Next.js (sin el prefijo `/api`) y reutiliza los mismos servicios:
 * el servidor sigue siendo la única autoridad sobre intentos, tiempo y puntos.
 */
import { z } from "zod";
import { timingFromEnv } from "@/lib/game/config";
import { isDateKey, nextChallengeStart } from "@/lib/game/daily";
import {
  actionIdSchema,
  actionRateLimit,
  actionSchema,
  errorPayload,
  modeSchema,
  rateLimit,
  readJson,
} from "./api-common";
import { getChallengeForDate, roscoPreview, todayKey } from "./challenges";
import { serverNow } from "./clock";
import type { Database } from "./db-core";
import { AppError, Errors } from "./errors";
import { sanitizeDisplayName } from "./names";
import type { Player } from "./players";
import { createRoom, getRoomView, joinRoom, leaveRoom, roomAction, setReady, sweepRooms } from "./room-service";
import { getSoloSession, getTodaySolo, soloAction, startSolo, sweepSoloSessions } from "./solo-service";
import { getLeaderboard, getMe, getStats, savePreferences } from "./stats-service";

export interface ApiHandlerOptions {
  getDb: () => Promise<Database>;
  /** Devuelve el jugador autenticado (o null si la petición no trae una identidad válida). */
  authenticate: (request: Request, db: Database) => Promise<Player | null>;
  /** Orígenes permitidos (CORS). "*" permite cualquiera: la API usa tokens Bearer, no cookies. */
  allowedOrigins: string[] | "*";
  /** Trabajo en segundo plano tras responder (p. ej. EdgeRuntime.waitUntil). */
  background?: (task: Promise<unknown>) => void;
}

type Handler = (ctx: Context) => Promise<Response>;

interface Context {
  request: Request;
  url: URL;
  params: string[];
  db: Database;
  player: () => Promise<Player>;
  optionalPlayer: () => Promise<Player | null>;
  respond: (data: unknown, status?: number) => Response;
}

const preferencesSchema = z.object({
  soundEnabled: z.boolean(),
  soundVolume: z.number().int().min(0).max(100),
  motion: z.enum(["system", "reduce", "full"]),
  highContrast: z.boolean(),
  largeText: z.boolean(),
});

const soloActionSchema = z.object({
  sessionId: z.uuid(),
  actionId: actionIdSchema,
  action: z.union([actionSchema, z.object({ type: z.literal("start_stage"), stage: z.number().int().min(0).max(10) })]),
});

let lastSweep = 0;

/** Normaliza la ruta: quita `/functions/v1`, el nombre de la función (`/api`) y la barra final. */
export function apiPath(pathname: string): string {
  let p = pathname.replace(/^\/functions\/v1/, "");
  p = p.replace(/^\/api(?=\/|$)/, "");
  p = p.replace(/\/+$/, "");
  return p || "/";
}

export function createApiHandler(options: ApiHandlerOptions): (request: Request) => Promise<Response> {
  const routes: { method: string; pattern: RegExp; handler: Handler }[] = [];
  const route = (method: string, pattern: RegExp, handler: Handler) => routes.push({ method, pattern, handler });

  route("GET", /^\/health$/, async ({ db, respond }) => {
    const now = await serverNow(db);
    return respond({ ok: true, database: db.kind, today: todayKey(now), serverNow: now });
  });

  route("GET", /^\/challenge$/, async ({ db, respond }) => {
    const now = await serverNow(db);
    const date = todayKey(now);
    const challenge = await getChallengeForDate(db, date);
    return respond({
      date,
      publicId: challenge.publicId,
      difficulty: challenge.difficulty,
      contentVersion: challenge.contentVersion,
      serverNow: now,
      nextResetAt: nextChallengeStart(now),
      letters: await roscoPreview(db, challenge.id),
      timing: timingFromEnv(),
    });
  });

  route("GET", /^\/me$/, async ({ db, player, respond }) => respond(await getMe(db, await player())));

  route("PATCH", /^\/me$/, async ({ db, request, player, respond }) => {
    const me = await player();
    rateLimit(`name:${me.id}`, 10, 60_000);
    const body = await readJson(request, z.object({ displayName: z.string().max(80) }));
    const result = sanitizeDisplayName(body.displayName);
    if (!result.ok) throw new AppError(400, "invalid_name", result.error);
    await db.query("update anonymous_players set display_name = $2, name_is_custom = true where id = $1", [
      me.id,
      result.name,
    ]);
    return respond(await getMe(db, { ...me, displayName: result.name, nameIsCustom: true }));
  });

  route("PUT", /^\/me\/preferences$/, async ({ db, request, player, respond }) => {
    const me = await player();
    rateLimit(`prefs:${me.id}`, 30, 60_000);
    return respond(await savePreferences(db, me.id, await readJson(request, preferencesSchema)));
  });

  route("GET", /^\/solo$/, async ({ db, player, respond }) =>
    respond({ session: await getTodaySolo(await player(), db) }),
  );

  route("POST", /^\/solo$/, async ({ db, request, player, respond }) => {
    const me = await player();
    rateLimit(`solo-start:${me.id}`, 10, 60_000);
    const { mode } = await readJson(request, z.object({ mode: modeSchema }));
    return respond({ session: await startSolo(me, mode, db) });
  });

  route("POST", /^\/solo\/action$/, async ({ db, request, player, respond }) => {
    const me = await player();
    rateLimit(`solo-action:${me.id}`, actionRateLimit(), 10_000);
    return respond(await soloAction(me, await readJson(request, soloActionSchema), db));
  });

  route("GET", /^\/solo\/([0-9a-f-]{36})$/, async ({ db, params, player, respond }) => {
    const session = await getSoloSession(await player(), params[0]!, db);
    if (!session) throw new AppError(404, "not_found", "Partida no encontrada.");
    return respond({ session });
  });

  /** Detalle de un resultado del historial (partida individual). */
  route("GET", /^\/results\/([0-9a-f-]{36})$/, async ({ db, params, player, respond }) => {
    const me = await player();
    const res = await db.query<{ session_id: string | null }>(
      "select session_id from game_results where id = $1 and player_id = $2",
      [params[0], me.id],
    );
    const sessionId = res.rows[0]?.session_id;
    const session = sessionId ? await getSoloSession(me, sessionId, db) : null;
    if (!session?.result) throw new AppError(404, "not_found", "Resultado no encontrado.");
    return respond({ session });
  });

  route("POST", /^\/rooms$/, async ({ db, request, player, respond }) => {
    const me = await player();
    rateLimit(`room-create:${me.id}`, 10, 60_000);
    const { mode } = await readJson(request, z.object({ mode: modeSchema }));
    return respond(await createRoom(me, mode, db), 201);
  });

  const codePattern = "([A-Za-z0-9_-]{12,40})";
  route("GET", new RegExp(`^/rooms/${codePattern}$`), async ({ db, params, player, respond }) =>
    respond({ room: (await getRoomView(await player(), params[0]!, db)).view }),
  );

  route("POST", new RegExp(`^/rooms/${codePattern}/join$`), async ({ db, params, player, respond }) => {
    const me = await player();
    rateLimit(`room-join:${me.id}`, 20, 60_000);
    await joinRoom(me, params[0]!, db);
    return respond({ room: (await getRoomView(me, params[0]!, db)).view });
  });

  route("POST", new RegExp(`^/rooms/${codePattern}/ready$`), async ({ db, params, request, player, respond }) => {
    const me = await player();
    rateLimit(`room-ready:${me.id}`, 30, 60_000);
    const { ready } = await readJson(request, z.object({ ready: z.boolean() }));
    await setReady(me, params[0]!, ready, db);
    return respond({ room: (await getRoomView(me, params[0]!, db)).view });
  });

  route("POST", new RegExp(`^/rooms/${codePattern}/leave$`), async ({ db, params, player, respond }) => {
    await leaveRoom(await player(), params[0]!, db);
    return respond({ ok: true });
  });

  route("POST", new RegExp(`^/rooms/${codePattern}/action$`), async ({ db, params, request, player, respond }) => {
    const me = await player();
    rateLimit(`room-action:${me.id}`, actionRateLimit(), 10_000);
    const body = await readJson(request, z.object({ actionId: actionIdSchema, action: actionSchema }));
    return respond(await roomAction(me, params[0]!, body, db));
  });

  route("GET", /^\/stats$/, async ({ db, player, respond }) => respond(await getStats(db, await player())));

  route("GET", /^\/leaderboard$/, async ({ db, url, optionalPlayer, respond }) => {
    const now = await serverNow(db);
    const date = url.searchParams.get("date") ?? todayKey(now);
    const mode = url.searchParams.get("mode") === "program" ? "program" : "rosco";
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(url.searchParams.get("limit"))) || 50));
    if (!isDateKey(date) || date > todayKey(now)) throw Errors.badRequest("Fecha no válida.");
    if (options.background && Date.now() - lastSweep > 60_000) {
      lastSweep = Date.now();
      options.background(Promise.all([sweepSoloSessions(db), sweepRooms(db)]).catch(() => undefined));
    }
    const me = await optionalPlayer();
    return respond(await getLeaderboard(db, { date, mode, playerId: me?.id ?? null, limit }));
  });

  const corsHeaders = (origin: string | null): Record<string, string> => {
    const allowed =
      options.allowedOrigins === "*"
        ? (origin ?? "*")
        : origin && options.allowedOrigins.includes(origin)
          ? origin
          : null;
    if (!allowed) return {};
    return {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  };

  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const cors = corsHeaders(origin);
    const respond = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors },
      });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      if (origin && options.allowedOrigins !== "*" && !options.allowedOrigins.includes(origin)) {
        throw new AppError(403, "forbidden_origin", "Origen no permitido.");
      }
      const url = new URL(request.url);
      const path = apiPath(url.pathname);
      const match = routes.find((r) => r.method === request.method && r.pattern.test(path));
      if (!match) throw new AppError(404, "not_found", "Ruta no encontrada.");
      const params = (path.match(match.pattern) ?? []).slice(1);
      const db = await options.getDb();
      let cached: Promise<Player | null> | null = null;
      const optionalPlayer = () => (cached ??= options.authenticate(request, db));
      const player = async () => {
        const p = await optionalPlayer();
        if (!p) throw new AppError(401, "unauthenticated", "Identidad anónima no válida. Recarga la página.");
        return p;
      };
      return await match.handler({ request, url, params, db, player, optionalPlayer, respond });
    } catch (error) {
      const { status, body } = errorPayload(error);
      return respond(body, status);
    }
  };
}

/** Extrae el token Bearer de la cabecera Authorization. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}
