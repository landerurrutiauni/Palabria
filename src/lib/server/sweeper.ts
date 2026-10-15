import { sweepRooms } from "./room-service";
import { sweepSoloSessions } from "./solo-service";

const globalForSweep = globalThis as unknown as { __palabriaLastSweep?: number; __palabriaSweeping?: boolean };
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Barrido oportunista (como máximo una vez por minuto y proceso): cierra
 * partidas vencidas y caduca salas antiguas. No bloquea la petición que lo
 * dispara y sus errores nunca afectan a la respuesta.
 */
export function maybeSweep(): void {
  const now = Date.now();
  if (globalForSweep.__palabriaSweeping) return;
  if (globalForSweep.__palabriaLastSweep && now - globalForSweep.__palabriaLastSweep < SWEEP_INTERVAL_MS) return;
  globalForSweep.__palabriaLastSweep = now;
  globalForSweep.__palabriaSweeping = true;
  Promise.all([sweepSoloSessions(), sweepRooms()])
    .catch((error: unknown) => console.error("[sweeper]", error))
    .finally(() => {
      globalForSweep.__palabriaSweeping = false;
    });
}
