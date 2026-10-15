/**
 * Criterio de clasificación del duelo 1 vs 1 (se comunica antes de jugar):
 *  1. Más respuestas correctas en El Rosco.
 *  2. Si hay empate, menos errores.
 *  3. Si continúa el empate, menos tiempo de rosco consumido.
 *  4. Si persiste, empate.
 * Quien abandona pierde siempre (si abandonan ambos, no hay ganador).
 */
export interface DuelScoreLine {
  correct: number;
  wrong: number;
  timeUsedMs: number;
}

export type Seat = 1 | 2;

/** Devuelve el asiento ganador o null si hay empate. */
export function duelWinner(a: DuelScoreLine, b: DuelScoreLine): Seat | null {
  if (a.correct !== b.correct) return a.correct > b.correct ? 1 : 2;
  if (a.wrong !== b.wrong) return a.wrong < b.wrong ? 1 : 2;
  // Se compara por segundos completos para evitar decidir por milisegundos de red.
  const ta = Math.round(a.timeUsedMs / 1000);
  const tb = Math.round(b.timeUsedMs / 1000);
  if (ta !== tb) return ta < tb ? 1 : 2;
  return null;
}

export function otherSeat(seat: Seat): Seat {
  return seat === 1 ? 2 : 1;
}

export const DUEL_RULES_TEXT = [
  "Gana quien acierte más letras de El Rosco.",
  "Si empatáis, gana quien tenga menos fallos.",
  "Si seguís empatados, gana quien haya consumido menos tiempo.",
  "Si aun así hay igualdad, el duelo termina en empate.",
  "Abandonar la partida cuenta como derrota.",
] as const;
