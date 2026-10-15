"use client";

import type { ApiErrorBody } from "@/lib/views";
import { IS_STATIC } from "./runtime";
import { accessToken, publicApiKey } from "./session";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
  get isNetwork(): boolean {
    return this.code === "network";
  }
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

/** En la versión estática, /api/... se sirve desde la Supabase Edge Function. */
function resolve(url: string): string {
  return IS_STATIC ? `${API_URL}${url.replace(/^\/api/, "")}` : url;
}

async function authHeaders(renew = false): Promise<Record<string, string>> {
  if (!IS_STATIC) return {};
  const headers: Record<string, string> = { Authorization: `Bearer ${await accessToken({ renew })}` };
  if (publicApiKey()) headers.apikey = publicApiKey();
  return headers;
}

/** Petición JSON al backend del juego. Los errores llegan como ApiError con mensaje en español. */
export async function api<T>(
  url: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
  retried = false,
): Promise<T> {
  let identity: Record<string, string>;
  try {
    identity = await authHeaders(retried);
  } catch (error) {
    throw new ApiError(0, "auth", `No se pudo iniciar tu identidad anónima: ${(error as Error).message}`);
  }
  let response: Response;
  try {
    response = await fetch(resolve(url), {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: {
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...identity,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      cache: "no-store",
      credentials: IS_STATIC ? "omit" : "same-origin",
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "network", "No hay conexión con el servidor. Comprueba tu red e inténtalo de nuevo.");
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (response.status === 401 && IS_STATIC && !retried) return api<T>(url, init, true);
  if (!response.ok) {
    const body = data as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? "http_error",
      body?.error?.message ?? `Error ${response.status} del servidor.`,
    );
  }
  return data as T;
}

/** Identificador único de cada acción: el servidor lo usa para ignorar reenvíos. */
export function newActionId(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
