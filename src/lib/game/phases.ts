import type { PhaseKind, StageKind } from "./content-types";

export interface PhaseRule {
  kind: PhaseKind;
  title: string;
  tagline: string;
  /** Explicación breve de la mecánica, mostrada antes de empezar. */
  howTo: string;
  /** Puntos por acierto (en «La pista justa», según las pistas vistas). */
  points: readonly number[];
  /** Segundos extra para El Rosco por acierto (programa completo). */
  bonusSeconds: readonly number[];
  soloItems: number;
  soloTimeMs: number;
  duelItemsPerPlayer: number;
  /** Tiempo por turno en el duelo. */
  duelShotClockMs: number;
  /** Número de pistas (solo «La pista justa»). */
  maxClues?: number;
}

export const PHASE_RULES: Record<PhaseKind, PhaseRule> = {
  quick: {
    kind: "quick",
    title: "Palabras al vuelo",
    tagline: "Definiciones rápidas contra el reloj",
    howTo:
      "Lee la definición y escribe la palabra. Ves la primera letra y su longitud. Si no la sabes, pasa: no hay segunda vuelta.",
    points: [10],
    bonusSeconds: [3],
    soloItems: 6,
    soloTimeMs: 60_000,
    duelItemsPerPlayer: 3,
    duelShotClockMs: 15_000,
  },
  clues: {
    kind: "clues",
    title: "La pista justa",
    tagline: "Cuantas menos pistas, más puntos",
    howTo:
      "Una palabra oculta y hasta cuatro pistas. Acierta con la primera pista y ganas 40 puntos; cada pista extra resta 10. Un fallo cierra la palabra.",
    points: [40, 30, 20, 10],
    bonusSeconds: [8, 6, 4, 2],
    soloItems: 2,
    soloTimeMs: 90_000,
    duelItemsPerPlayer: 1,
    duelShotClockMs: 40_000,
    maxClues: 4,
  },
  saying: {
    kind: "saying",
    title: "Dichos y hechos",
    tagline: "Completa refranes y expresiones",
    howTo: "Escribe la palabra que falta en cada refrán o expresión popular. Te damos su número de letras.",
    points: [15],
    bonusSeconds: [3],
    soloItems: 5,
    soloTimeMs: 60_000,
    duelItemsPerPlayer: 2,
    duelShotClockMs: 15_000,
  },
  link: {
    kind: "link",
    title: "El eslabón",
    tagline: "Cuatro palabras, un vínculo",
    howTo:
      "Encuentra la palabra que une a las cuatro que aparecen: puede combinarse con todas o ser lo que tienen en común.",
    points: [20],
    bonusSeconds: [5],
    soloItems: 3,
    soloTimeMs: 75_000,
    duelItemsPerPlayer: 2,
    duelShotClockMs: 20_000,
  },
};

export const PROGRAM_PHASES: readonly PhaseKind[] = ["quick", "clues", "saying", "link"];
export const PROGRAM_STAGES: readonly StageKind[] = [...PROGRAM_PHASES, "rosco"];
export const ROSCO_ONLY_STAGES: readonly StageKind[] = ["rosco"];

export const ROSCO_STAGE_INFO = {
  title: "El Rosco",
  tagline: "27 letras, un reloj y la palabra justa",
};

export function stageTitle(kind: StageKind): string {
  return kind === "rosco" ? ROSCO_STAGE_INFO.title : PHASE_RULES[kind].title;
}

export function stageTagline(kind: StageKind): string {
  return kind === "rosco" ? ROSCO_STAGE_INFO.tagline : PHASE_RULES[kind].tagline;
}

/** Puntos de un acierto en una prueba (para «La pista justa» depende de las pistas vistas). */
export function phasePointsFor(kind: PhaseKind, cluesShown: number): number {
  const table = PHASE_RULES[kind].points;
  const idx = Math.min(Math.max(cluesShown, 1), table.length) - 1;
  return table[idx] ?? 0;
}

export function phaseBonusMsFor(kind: PhaseKind, cluesShown: number): number {
  const table = PHASE_RULES[kind].bonusSeconds;
  const idx = Math.min(Math.max(cluesShown, 1), table.length) - 1;
  return (table[idx] ?? 0) * 1000;
}

export type GameMode = "rosco" | "program";

export function stagesForMode(mode: GameMode): readonly StageKind[] {
  return mode === "rosco" ? ROSCO_ONLY_STAGES : PROGRAM_STAGES;
}

export function modeLabel(mode: GameMode): string {
  return mode === "rosco" ? "Solo El Rosco" : "Programa completo";
}

/** Nombre de la dificultad del desafío del día. */
export function difficultyLabel(d: string): string {
  return d === "facil" ? "Fácil" : d === "dificil" ? "Difícil" : "Media";
}
