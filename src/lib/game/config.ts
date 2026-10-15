/**
 * Reglas de tiempo configurables. Se leen del entorno en el servidor y se
 * copian en cada partida al crearla, de modo que una partida empezada nunca
 * cambia de reglas aunque cambie la configuración.
 */
export interface TimingConfig {
  /** Tiempo de «Solo El Rosco» (individual). */
  soloRoscoMs: number;
  /** Tiempo base del rosco final del programa completo (se suman los segundos ganados). */
  programRoscoBaseMs: number;
  /** Tiempo de cada jugador en el duelo «Solo El Rosco». */
  duelRoscoMs: number;
  /** Tiempo base del rosco final en el duelo de programa completo. */
  duelProgramRoscoBaseMs: number;
  /** Margen de reconexión antes de declarar abandono en un duelo. */
  reconnectGraceMs: number;
  /** Cuenta atrás antes del primer turno de un duelo. */
  duelStartDelayMs: number;
  /** Pausa entre pruebas del duelo. */
  duelStageGapMs: number;
  /** Tiempo máximo de espera entre pruebas del programa individual. */
  intermissionTimeoutMs: number;
  /** Validez de una sala sin empezar. */
  roomWaitingTtlMs: number;
}

export const DEFAULT_TIMING: TimingConfig = {
  soloRoscoMs: 180_000,
  programRoscoBaseMs: 120_000,
  duelRoscoMs: 180_000,
  duelProgramRoscoBaseMs: 120_000,
  reconnectGraceMs: 45_000,
  duelStartDelayMs: 3_500,
  duelStageGapMs: 5_000,
  intermissionTimeoutMs: 30 * 60_000,
  roomWaitingTtlMs: 3 * 60 * 60_000,
};

function secondsFromEnv(name: string, fallbackMs: number, min: number, max: number): number {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  if (!raw) return fallbackMs;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return fallbackMs;
  return Math.round(value * 1000);
}

export function timingFromEnv(): TimingConfig {
  return {
    soloRoscoMs: secondsFromEnv("ROSCO_SECONDS", DEFAULT_TIMING.soloRoscoMs, 10, 900),
    programRoscoBaseMs: secondsFromEnv("PROGRAM_ROSCO_BASE_SECONDS", DEFAULT_TIMING.programRoscoBaseMs, 10, 900),
    duelRoscoMs: secondsFromEnv("DUEL_ROSCO_SECONDS", DEFAULT_TIMING.duelRoscoMs, 10, 900),
    duelProgramRoscoBaseMs: secondsFromEnv(
      "DUEL_PROGRAM_ROSCO_BASE_SECONDS",
      DEFAULT_TIMING.duelProgramRoscoBaseMs,
      10,
      900,
    ),
    reconnectGraceMs: secondsFromEnv("DUEL_RECONNECT_GRACE_SECONDS", DEFAULT_TIMING.reconnectGraceMs, 5, 600),
    duelStartDelayMs: DEFAULT_TIMING.duelStartDelayMs,
    duelStageGapMs: DEFAULT_TIMING.duelStageGapMs,
    intermissionTimeoutMs: DEFAULT_TIMING.intermissionTimeoutMs,
    roomWaitingTtlMs: secondsFromEnv("ROOM_WAITING_TTL_SECONDS", DEFAULT_TIMING.roomWaitingTtlMs, 60, 86_400),
  };
}
