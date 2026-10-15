/**
 * Aritmética de relojes basada en marcas de tiempo (nunca en contadores
 * que restan un segundo por intervalo). Todos los valores en milisegundos.
 *
 * Un reloj se representa con:
 *  - bankMs: tiempo restante acumulado en el momento de la última parada,
 *  - startedAt: instante en que se puso en marcha (null si está detenido).
 * `startedAt` puede estar en el futuro (cuenta atrás previa): mientras tanto
 * no se consume tiempo.
 */

export function elapsedSince(startedAt: number | null, now: number): number {
  if (startedAt === null) return 0;
  return Math.max(0, now - startedAt);
}

export function remainingMs(bankMs: number, startedAt: number | null, now: number): number {
  return Math.max(0, bankMs - elapsedSince(startedAt, now));
}

export function isExpired(bankMs: number, startedAt: number | null, now: number): boolean {
  return startedAt !== null && remainingMs(bankMs, startedAt, now) <= 0;
}

/** Detiene el reloj y devuelve el nuevo banco de tiempo. */
export function stopClock(bankMs: number, startedAt: number | null, now: number): number {
  return remainingMs(bankMs, startedAt, now);
}

/** Instante exacto en que el reloj llegará (o llegó) a cero. */
export function expiresAt(bankMs: number, startedAt: number | null): number | null {
  return startedAt === null ? null : startedAt + bankMs;
}

/** Formato mm:ss para marcadores (redondea hacia arriba los segundos). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Formato de duración legible: «2 min 41 s». */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s} s`;
  return `${m} min ${s.toString().padStart(2, "0")} s`;
}
