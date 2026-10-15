/**
 * Utilidades HTTP portables (sin dependencias de Next.js): validación de
 * entradas, traducción de errores y límite de ráfagas.
 */
import { z } from "zod";
import { GameRuleError } from "@/lib/game/errors";
import type { ApiErrorBody } from "@/lib/views";
import { AppError } from "./errors";

export function errorPayload(error: unknown): { status: number; body: ApiErrorBody } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message, details: error.details } },
    };
  }
  if (error instanceof GameRuleError) {
    return { status: 409, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof z.ZodError) {
    return { status: 400, body: { error: { code: "bad_request", message: "Datos no válidos." } } };
  }
  console.error("[api]", error);
  return {
    status: 500,
    body: { error: { code: "server_error", message: "Ha ocurrido un error en el servidor. Inténtalo de nuevo." } },
  };
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new AppError(415, "unsupported_media_type", "Se esperaba JSON.");
  const text = await request.text();
  if (text.length > 4_096) throw new AppError(413, "payload_too_large", "Petición demasiado grande.");
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new AppError(400, "bad_json", "JSON no válido.");
  }
  return schema.parse(body);
}

/** Cuerpo JSON opcional: sin cuerpo (o sin tipo JSON) equivale a «{}». */
export async function readOptionalJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return schema.parse({});
  return readJson(request, schema);
}

/* Limitador sencillo en memoria (por proceso) contra ráfagas abusivas. */
const globalForRate = globalThis as unknown as { __palabriaRate?: Map<string, { count: number; reset: number }> };

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const map = (globalForRate.__palabriaRate ??= new Map());
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || entry.reset < now) {
    map.set(key, { count: 1, reset: now + windowMs });
    if (map.size > 50_000) map.clear();
    return;
  }
  entry.count += 1;
  if (entry.count > limit)
    throw new AppError(429, "rate_limited", "Demasiadas peticiones seguidas. Espera un momento.");
}

/** Acciones de juego permitidas por jugador cada 10 s (configurable). */
export function actionRateLimit(): number {
  const value = Number(process.env.ACTION_RATE_LIMIT ?? 60);
  return Number.isFinite(value) && value > 0 ? value : 60;
}

export const modeSchema = z.enum(["rosco", "program"]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("answer"),
    stage: z.number().int().min(0).max(10),
    item: z.number().int().min(0).max(40),
    text: z.string().max(120),
  }),
  z.object({ type: z.literal("pass"), stage: z.number().int().min(0).max(10), item: z.number().int().min(0).max(40) }),
  z.object({ type: z.literal("clue"), stage: z.number().int().min(0).max(10), item: z.number().int().min(0).max(40) }),
]);

export const actionIdSchema = z.uuid();
