import type { PhaseKind } from "./content-types";
import { PHASE_RULES, phaseBonusMsFor, phasePointsFor } from "./phases";

export type ItemOutcome = "pending" | "correct" | "wrong" | "passed" | "timeout";

/** Progreso de un elemento de una prueba previa (no rosco). */
export interface PhaseItemProgress {
  outcome: ItemOutcome;
  /** Pistas visibles (solo «La pista justa»; empieza en 1). */
  cluesShown: number;
  points: number;
  bonusMs: number;
  given: string | null;
}

export function createPhaseItems(kind: PhaseKind, count: number): PhaseItemProgress[] {
  return Array.from({ length: count }, () => ({
    outcome: "pending" as const,
    cluesShown: kind === "clues" ? 1 : 0,
    points: 0,
    bonusMs: 0,
    given: null,
  }));
}

export function currentItemIndex(items: readonly PhaseItemProgress[]): number | null {
  const idx = items.findIndex((i) => i.outcome === "pending");
  return idx === -1 ? null : idx;
}

export function resolveItem(
  kind: PhaseKind,
  item: PhaseItemProgress,
  outcome: Exclude<ItemOutcome, "pending">,
  given: string | null,
): PhaseItemProgress {
  if (item.outcome !== "pending") throw new Error("El elemento ya está resuelto");
  const correct = outcome === "correct";
  return {
    ...item,
    outcome,
    given,
    points: correct ? phasePointsFor(kind, item.cluesShown) : 0,
    bonusMs: correct ? phaseBonusMsFor(kind, item.cluesShown) : 0,
  };
}

export function canRevealClue(kind: PhaseKind, item: PhaseItemProgress): boolean {
  return kind === "clues" && item.outcome === "pending" && item.cluesShown < (PHASE_RULES.clues.maxClues ?? 4);
}

export function revealClue(kind: PhaseKind, item: PhaseItemProgress): PhaseItemProgress {
  if (!canRevealClue(kind, item)) throw new Error("No quedan pistas");
  return { ...item, cluesShown: item.cluesShown + 1 };
}

export function sumPhase(items: readonly PhaseItemProgress[]): { points: number; bonusMs: number; correct: number } {
  let points = 0;
  let bonusMs = 0;
  let correct = 0;
  for (const i of items) {
    points += i.points;
    bonusMs += i.bonusMs;
    if (i.outcome === "correct") correct += 1;
  }
  return { points, bonusMs, correct };
}
