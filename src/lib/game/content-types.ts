import type { Letter, LetterMode } from "./alphabet";

/** Pruebas previas del programa completo. */
export type PhaseKind = "quick" | "clues" | "saying" | "link";
/** Cualquier fase de una partida (las pruebas previas o El Rosco). */
export type StageKind = PhaseKind | "rosco";

export type Difficulty = 1 | 2 | 3;

export type QuestionPrompt =
  | { kind: "rosco"; letter: Letter; mode: LetterMode; definition: string }
  | { kind: "quick"; definition: string }
  | { kind: "clues"; clues: string[] }
  | { kind: "saying"; text: string }
  | { kind: "link"; words: string[] };

/** Pregunta con sus respuestas aceptadas (solo existe en el servidor). */
export interface ContentItem<P extends QuestionPrompt = QuestionPrompt> {
  /** Identificador estable del elemento en el banco de preguntas. */
  id: string;
  prompt: P;
  /** La primera es la respuesta canónica; el resto, variantes válidas explícitas. */
  answers: string[];
  difficulty: Difficulty;
}

export type RoscoItem = ContentItem<Extract<QuestionPrompt, { kind: "rosco" }>>;
export type QuickItem = ContentItem<Extract<QuestionPrompt, { kind: "quick" }>>;
export type CluesItem = ContentItem<Extract<QuestionPrompt, { kind: "clues" }>>;
export type SayingItem = ContentItem<Extract<QuestionPrompt, { kind: "saying" }>>;
export type LinkItem = ContentItem<Extract<QuestionPrompt, { kind: "link" }>>;

/** Contenido que recibe un jugador: un rosco y los elementos de cada prueba. */
export interface QuestionSet {
  rosco: RoscoItem[];
  quick: QuickItem[];
  clues: CluesItem[];
  saying: SayingItem[];
  link: LinkItem[];
}

export type QuestionSetKey = "solo" | "duel_a" | "duel_b";

export interface ChallengeContent {
  solo: QuestionSet;
  duel_a: QuestionSet;
  duel_b: QuestionSet;
}

export function itemsForStage(set: QuestionSet, stage: StageKind): ContentItem[] {
  return set[stage];
}
