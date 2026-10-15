import type { Queryable } from "./db-core";

/**
 * Hora oficial del juego. Se toma del reloj de la base de datos para que
 * todas las instancias del servidor compartan la misma referencia; el
 * navegador nunca decide el tiempo restante ni la fecha del desafío.
 */
let override: (() => number) | null = null;

export async function serverNow(db: Queryable): Promise<number> {
  if (override) return override();
  const res = await db.query<{ now: number }>("select (extract(epoch from clock_timestamp()) * 1000)::bigint as now");
  return Number(res.rows[0]?.now ?? Date.now());
}

/** Fija la hora del servidor en las pruebas automáticas. */
export function setClockForTesting(fn: (() => number) | null): void {
  override = fn;
}
