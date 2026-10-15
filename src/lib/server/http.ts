import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/lib/views";
import { errorPayload } from "./api-common";
import { AppError } from "./errors";

export { actionIdSchema, actionRateLimit, actionSchema, modeSchema, rateLimit, readJson } from "./api-common";

export function json<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  const { status, body } = errorPayload(error);
  return json(body, { status });
}

/**
 * Protección CSRF básica: las peticiones que modifican datos deben venir del
 * mismo origen (además, la cookie de identidad es SameSite=Lax).
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new AppError(403, "forbidden_origin", "Origen no permitido.");
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(403, "forbidden_origin", "Origen no permitido.");
  }
}
