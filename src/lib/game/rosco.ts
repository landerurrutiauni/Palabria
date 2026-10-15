import { ROSCO_SIZE } from "./alphabet";

/**
 * Estado de cada letra del rosco.
 *  - pending: aún no se ha preguntado en esta partida.
 *  - passed: se dijo «Pasapalabra»; pendiente de recuperar en otra vuelta.
 *  - correct / wrong: resuelta.
 * El estado visual «activa» se deriva del cursor y el estado «no jugada»
 * se deriva de las letras abiertas cuando el rosco ha terminado.
 */
export type LetterStatus = "pending" | "passed" | "correct" | "wrong";

export type RoscoOutcome = "correct" | "wrong" | "passed";

export interface RoscoProgress {
  statuses: LetterStatus[];
  /** Letra que se está preguntando; null cuando no queda ninguna abierta. */
  cursor: number | null;
}

export interface RoscoCounts {
  correct: number;
  wrong: number;
  passed: number;
  pending: number;
  /** Letras sin resolver (pendientes + pasadas). */
  open: number;
}

export function createRosco(size: number = ROSCO_SIZE): RoscoProgress {
  return { statuses: Array.from({ length: size }, () => "pending"), cursor: 0 };
}

export function isOpen(status: LetterStatus | undefined): boolean {
  return status === "pending" || status === "passed";
}

/**
 * Siguiente letra abierta siguiendo el orden del rosco a partir de `from`
 * (excluida), con vuelta circular. Si `from` es la única abierta, la devuelve.
 */
export function nextOpenIndex(statuses: readonly LetterStatus[], from: number): number | null {
  const n = statuses.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if (isOpen(statuses[idx])) return idx;
  }
  return null;
}

/** Aplica el resultado de la letra activa y avanza el cursor. Pura: no muta. */
export function applyRoscoOutcome(progress: RoscoProgress, index: number, outcome: RoscoOutcome): RoscoProgress {
  if (progress.cursor === null) throw new Error("El rosco ya ha terminado");
  if (index !== progress.cursor) throw new Error("La letra no es la activa");
  if (!isOpen(progress.statuses[index])) throw new Error("La letra ya está resuelta");
  const statuses = progress.statuses.slice();
  statuses[index] = outcome;
  return { statuses, cursor: nextOpenIndex(statuses, index) };
}

export function roscoCounts(progress: RoscoProgress): RoscoCounts {
  const counts: RoscoCounts = { correct: 0, wrong: 0, passed: 0, pending: 0, open: 0 };
  for (const s of progress.statuses) {
    counts[s] += 1;
    if (isOpen(s)) counts.open += 1;
  }
  return counts;
}

export function isRoscoResolved(progress: RoscoProgress): boolean {
  return progress.cursor === null;
}

/** Estado visual de una letra para la interfaz. */
export type LetterVisualState = "pending" | "active" | "correct" | "wrong" | "passed" | "unplayed";

export function letterVisualState(progress: RoscoProgress, index: number, finished: boolean): LetterVisualState {
  const status = progress.statuses[index] ?? "pending";
  if (status === "correct" || status === "wrong") return status;
  if (finished) return "unplayed";
  if (progress.cursor === index) return "active";
  return status;
}
