/**
 * Formato compacto del banco de preguntas (editable a mano).
 *
 * Rosco: [letra, modo, respuestas, definición, dificultad]
 *   - modo: "s" = empieza por la letra, "c" = contiene la letra.
 *   - respuestas: la canónica primero; variantes válidas separadas por «|».
 *   - dificultad: 1 fácil, 2 media, 3 difícil.
 */
export type RawRosco = readonly [
  letter: string,
  mode: "s" | "c",
  answers: string,
  definition: string,
  difficulty: 1 | 2 | 3,
];

/** Palabras al vuelo: [definición, respuestas, dificultad] */
export type RawQuick = readonly [definition: string, answers: string, difficulty: 1 | 2 | 3];

/** La pista justa: [[pista1..pista4], respuestas, dificultad] (de más vaga a más concreta) */
export type RawClues = readonly [
  clues: readonly [string, string, string, string],
  answers: string,
  difficulty: 1 | 2 | 3,
];

/** Dichos y hechos: [texto con «___», respuestas, dificultad] */
export type RawSaying = readonly [text: string, answers: string, difficulty: 1 | 2 | 3];

/** El eslabón: [[4 palabras], respuestas, dificultad] */
export type RawLink = readonly [
  words: readonly [string, string, string, string],
  answers: string,
  difficulty: 1 | 2 | 3,
];
