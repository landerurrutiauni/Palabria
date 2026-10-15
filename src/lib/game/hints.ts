import type { PhaseKind } from "./content-types";
import { letterCount, normalizeAnswer } from "./normalize";

/** Pista visible (sin revelar la respuesta) para una prueba previa. */
export function phaseHint(kind: PhaseKind, canonicalAnswer: string): string {
  const n = letterCount(canonicalAnswer);
  const first = normalizeAnswer(canonicalAnswer).charAt(0).toUpperCase();
  const words = normalizeAnswer(canonicalAnswer).split(" ").length;
  const size = words > 1 ? `${words} palabras · ${n} letras` : `${n} letras`;
  switch (kind) {
    case "quick":
    case "link":
      return `Empieza por ${first} · ${size}`;
    case "clues":
    case "saying":
      return size;
  }
}
