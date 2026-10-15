"use client";

import type { ApiErrorBody } from "@/lib/views";

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

/** Petición JSON al backend propio. Los errores llegan como ApiError con mensaje en español. */
export async function api<T>(url: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      cache: "no-store",
      credentials: "same-origin",
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
