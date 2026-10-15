import { ALPHABET } from "@/lib/game/alphabet";
import type { QuestionSet } from "@/lib/game/content-types";

/** Contenido sintético para probar el motor: la respuesta de cada letra es «<letra><sufijo>». */
export function makeSet(suffix: string): QuestionSet {
  return {
    rosco: ALPHABET.map((letter) => ({
      id: `r-${letter}-${suffix}`,
      prompt: { kind: "rosco" as const, letter, mode: "starts" as const, definition: `Definición de ${letter}` },
      answers: [`${letter.toLowerCase()}${suffix}`],
      difficulty: 2 as const,
    })),
    quick: Array.from({ length: 6 }, (_, i) => ({
      id: `q-${i}-${suffix}`,
      prompt: { kind: "quick" as const, definition: `Rápida ${i}` },
      answers: [`rapida${i}${suffix}`],
      difficulty: 1 as const,
    })),
    clues: Array.from({ length: 2 }, (_, i) => ({
      id: `c-${i}-${suffix}`,
      prompt: { kind: "clues" as const, clues: ["p1", "p2", "p3", "p4"] },
      answers: [`pista${i}${suffix}`],
      difficulty: 2 as const,
    })),
    saying: Array.from({ length: 5 }, (_, i) => ({
      id: `s-${i}-${suffix}`,
      prompt: { kind: "saying" as const, text: `Dicho ${i} ___` },
      answers: [`dicho${i}${suffix}`],
      difficulty: 1 as const,
    })),
    link: Array.from({ length: 3 }, (_, i) => ({
      id: `l-${i}-${suffix}`,
      prompt: { kind: "link" as const, words: ["a", "b", "c", "d"] },
      answers: [`enlace${i}${suffix}`],
      difficulty: 2 as const,
    })),
  };
}

export function roscoAnswer(set: QuestionSet, index: number): string {
  return set.rosco[index]!.answers[0]!;
}
