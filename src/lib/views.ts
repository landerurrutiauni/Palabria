/**
 * Tipos de las vistas que el servidor envía al navegador.
 * Nunca contienen respuestas de preguntas que aún no se hayan cerrado.
 */
import type { LetterMode } from "./game/alphabet";
import type { PhaseKind, StageKind } from "./game/content-types";
import type { ItemOutcome } from "./game/phase-items";
import type { GameMode } from "./game/phases";
import type { LetterStatus, LetterVisualState } from "./game/rosco";
import type { SoloStatus, StageEndReason, StageStatus } from "./game/solo-engine";

export type Seat = 1 | 2;

export interface LetterView {
  letter: string;
  mode: LetterMode;
  state: LetterVisualState;
}

export type PromptView =
  | { kind: "rosco"; index: number; letter: string; mode: LetterMode; definition: string }
  | { kind: "quick"; index: number; definition: string; hint: string }
  | {
      kind: "clues";
      index: number;
      clues: string[];
      totalClues: number;
      hint: string;
      canRevealClue: boolean;
      pointsNow: number;
    }
  | { kind: "saying"; index: number; text: string; hint: string }
  | { kind: "link"; index: number; words: string[]; hint: string };

export interface PhaseItemView {
  index: number;
  outcome: ItemOutcome;
  points: number;
  answer: string | null;
  given: string | null;
}

export interface StageSummaryView {
  kind: StageKind;
  title: string;
  status: StageStatus;
  points: number;
  endReason: StageEndReason | null;
}

export interface FeedbackView {
  outcome: "correct" | "wrong" | "passed" | "timeout" | "clue";
  answer: string | null;
  given: string | null;
  points: number;
  stageKind: StageKind;
  item: number | null;
}

export interface RevealedLetter {
  letter: string;
  mode: LetterMode;
  definition: string;
  answer: string;
  given: string | null;
  status: LetterStatus;
}

export interface PhaseReview {
  kind: PhaseKind;
  title: string;
  points: number;
  items: { prompt: string; answer: string; given: string | null; outcome: ItemOutcome; points: number }[];
}

export interface SoloResultView {
  status: SoloStatus;
  mode: GameMode;
  date: string;
  score: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number;
  roscoTimeUsedMs: number;
  totalTimeUsedMs: number;
  phasePoints: number;
  roscoPoints: number;
  bonusSeconds: number;
  perfect: boolean;
  roscoComplete: boolean;
  letters: RevealedLetter[];
  phases: PhaseReview[];
  streak: { current: number; best: number };
  shareText: string;
}

export interface SoloView {
  sessionId: string;
  mode: GameMode;
  status: SoloStatus;
  date: string;
  serverNow: number;
  version: number;
  stageIndex: number;
  stages: StageSummaryView[];
  stage: {
    kind: StageKind;
    title: string;
    tagline: string;
    howTo: string;
    status: StageStatus;
    startedAt: number | null;
    timeLimitMs: number;
    remainingMs: number;
    itemCount: number;
    prompt: PromptView | null;
    items: PhaseItemView[];
    letters: LetterView[];
    /** Respuestas de letras ya cerradas (acierto o fallo). */
    revealed: Record<number, string>;
  };
  /** Tiempo con el que empezará El Rosco del programa (base + segundos ganados). */
  upcomingRoscoMs: number | null;
  readyDeadline: number | null;
  totals: {
    phasePoints: number;
    bonusSeconds: number;
    correct: number;
    wrong: number;
    passed: number;
    open: number;
  };
  result: SoloResultView | null;
}

export type RoomStatus = "waiting" | "ready" | "in_progress" | "completed" | "abandoned" | "expired";
export type ParticipantStatus = "joined" | "playing" | "finished" | "out_of_time" | "abandoned";

export interface DuelPlayerView {
  seat: Seat;
  name: string;
  isYou: boolean;
  connected: boolean;
  ready: boolean;
  status: ParticipantStatus;
  bankMs: number;
  running: boolean;
  correct: number;
  wrong: number;
  passed: number;
  open: number;
  phasePoints: number;
  bonusSeconds: number;
  timeUsedMs: number;
  letters: LetterView[];
  /** Resultado de cada elemento de la prueba previa actual. */
  phaseOutcomes: ItemOutcome[];
}

export interface DuelLastAction {
  seat: Seat;
  outcome: "correct" | "wrong" | "passed" | "timeout" | "clue";
  stageKind: StageKind;
  turnChanged: boolean;
  at: number;
}

export interface DuelResultView {
  outcome: "win" | "loss" | "draw" | null;
  winnerSeat: Seat | null;
  endReason: "completed" | "abandoned" | "expired" | "cancelled" | null;
  you: { letters: RevealedLetter[]; phases: PhaseReview[] } | null;
  rival: { letters: RevealedLetter[] } | null;
  shareText: string | null;
}

export interface DuelView {
  code: string;
  mode: GameMode;
  status: RoomStatus;
  date: string;
  serverNow: number;
  version: number;
  you: Seat | null;
  isHost: boolean;
  canJoin: boolean;
  joinBlockedReason: string | null;
  hostName: string;
  expiresAt: number | null;
  stages: StageKind[];
  stage: { index: number; kind: StageKind; title: string; howTo: string; itemsPerPlayer: number };
  turn: { seat: Seat | null; startedAt: number | null; shotClockMs: number | null; number: number };
  players: Partial<Record<Seat, DuelPlayerView>>;
  /** Pregunta actual: solo para el jugador que tiene el turno. */
  prompt: PromptView | null;
  /** Respuesta revelada al jugador tras cerrar su última pregunta. */
  feedback: FeedbackView | null;
  lastAction: DuelLastAction | null;
  rules: { roscoSeconds: number; graceSeconds: number; shotClocks: Record<PhaseKind, number> };
  result: DuelResultView | null;
}

export interface AttemptStatus {
  solo: { used: boolean; mode: GameMode | null; sessionId: string | null; status: SoloStatus | null };
  duel: { used: boolean; roomCode: string | null; status: RoomStatus | null; openRoomCode: string | null };
}

export interface MeView {
  id: string;
  displayName: string;
  nameIsCustom: boolean;
  today: string;
  nextResetAt: number;
  serverNow: number;
  attempts: AttemptStatus;
  streak: { current: number; best: number };
  preferences: PreferencesView;
}

export interface PreferencesView {
  soundEnabled: boolean;
  soundVolume: number;
  motion: "system" | "reduce" | "full";
  highContrast: boolean;
  largeText: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export interface HistoryEntry {
  id: string;
  date: string;
  kind: "solo" | "duel";
  mode: GameMode;
  status: "completed" | "abandoned";
  correct: number;
  wrong: number;
  unanswered: number;
  score: number;
  timeUsedMs: number;
  outcome: "win" | "loss" | "draw" | null;
  opponentName: string | null;
  perfect: boolean;
  link: string | null;
}

export interface StatsView {
  solo: {
    played: number;
    completed: number;
    correct: number;
    wrong: number;
    accuracy: number;
    bestScoreRosco: number | null;
    bestScoreProgram: number | null;
    bestTimeMs: number | null;
    roscosCompleted: number;
    perfectRoscos: number;
  };
  duel: {
    played: number;
    wins: number;
    losses: number;
    draws: number;
    correct: number;
    wrong: number;
    accuracy: number;
  };
  streak: { current: number; best: number; lastDate: string | null };
  history: HistoryEntry[];
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  correct: number;
  wrong: number;
  timeUsedMs: number;
  perfect: boolean;
  isYou: boolean;
}

export interface LeaderboardView {
  date: string;
  mode: GameMode;
  total: number;
  minEntries: number;
  entries: LeaderboardEntry[];
  you: LeaderboardEntry | null;
}
