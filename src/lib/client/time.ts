"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Diferencia entre el reloj del servidor y el del navegador. El tiempo
 * restante se calcula siempre a partir de marcas del servidor; el navegador
 * solo lo representa.
 */
export function useServerOffset(serverNow: number | null | undefined): number {
  const [offset, setOffset] = useState(0);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (serverNow == null || serverNow === last.current) return;
    last.current = serverNow;
    setOffset(serverNow - Date.now());
  }, [serverNow]);
  return offset;
}

/**
 * Vuelve a renderizar periódicamente mientras `active` sea verdadero.
 * Devuelve null hasta montarse en el navegador, para que el HTML del servidor
 * y la primera hidratación usen la misma referencia (la hora del servidor).
 */
export function useNow(active: boolean, intervalMs = 200): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    if (!active) return () => window.clearTimeout(first);
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active, intervalMs]);
  return now;
}

/** Hora estimada del servidor: la de la última respuesta hasta que el reloj local arranca. */
export function estimateServerNow(tick: number | null, offset: number, serverNow: number): number {
  return tick === null ? serverNow : tick + offset;
}

export function remainingFrom(
  bankMs: number,
  startedAt: number | null,
  running: boolean,
  serverNowEstimate: number,
): number {
  if (!running || startedAt === null) return bankMs;
  return Math.max(0, bankMs - Math.max(0, serverNowEstimate - startedAt));
}
