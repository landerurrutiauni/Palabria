/**
 * Puntuación (siempre calculada en el servidor a partir del estado verificado).
 *
 * El Rosco:
 *   +10 por acierto, −5 por fallo (el rosco nunca puntúa por debajo de 0)
 *   + 1 punto por cada segundo sobrante si no queda ninguna letra sin resolver.
 * Programa completo: puntos de las pruebas previas + puntos del rosco.
 */
export const ROSCO_POINTS_CORRECT = 10;
export const ROSCO_POINTS_WRONG = -5;

export interface RoscoScoreInput {
  correct: number;
  wrong: number;
  open: number;
  remainingMs: number;
}

export function roscoPoints({ correct, wrong, open, remainingMs }: RoscoScoreInput): number {
  const base = Math.max(0, correct * ROSCO_POINTS_CORRECT + wrong * ROSCO_POINTS_WRONG);
  const timeBonus = open === 0 ? Math.floor(Math.max(0, remainingMs) / 1000) : 0;
  return base + timeBonus;
}

export function accuracy(correct: number, wrong: number): number {
  const answered = correct + wrong;
  return answered === 0 ? 0 : Math.round((correct / answered) * 100);
}
