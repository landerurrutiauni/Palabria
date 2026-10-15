/**
 * Motor del modo individual (Solo El Rosco y Programa completo).
 * Funciones puras: reciben el estado, la acción, el contenido y el instante
 * actual del servidor, y devuelven un estado nuevo. Nunca mutan la entrada.
 */
import type { PhaseKind, QuestionSet, StageKind } from "./content-types";
import type { TimingConfig } from "./config";
import { GameRuleError } from "./errors";
import { isCorrectAnswer, sanitizeGivenAnswer } from "./normalize";
import {
  canRevealClue,
  createPhaseItems,
  currentItemIndex,
  resolveItem,
  revealClue,
  sumPhase,
  type PhaseItemProgress,
} from "./phase-items";
import { PHASE_RULES, stagesForMode, type GameMode } from "./phases";
import { applyRoscoOutcome, createRosco, roscoCounts, type RoscoCounts, type RoscoProgress } from "./rosco";
import { roscoPoints } from "./scoring";

export type SoloStatus = "in_progress" | "completed" | "abandoned";
export type StageStatus = "locked" | "ready" | "playing" | "done";
export type StageEndReason = "completed" | "timeout" | "abandoned";

export interface SoloStage {
  kind: StageKind;
  status: StageStatus;
  startedAt: number | null;
  endedAt: number | null;
  timeLimitMs: number;
  endReason: StageEndReason | null;
  items: PhaseItemProgress[];
  rosco: RoscoProgress | null;
  roscoGiven: (string | null)[] | null;
}

export interface SoloRules {
  mode: GameMode;
  /** Rosco individual: tiempo total. Programa: tiempo base del rosco final. */
  roscoMs: number;
  intermissionTimeoutMs: number;
  phaseTimeMs: Record<PhaseKind, number>;
  phaseItems: Record<PhaseKind, number>;
}

export interface SoloState {
  schema: 1;
  mode: GameMode;
  rules: SoloRules;
  status: SoloStatus;
  stageIndex: number;
  stages: SoloStage[];
  /** Momento en que la prueba actual quedó lista (entreacto sin reloj). */
  readySince: number | null;
  createdAt: number;
  finishedAt: number | null;
}

export type SoloAction =
  | { type: "start_stage"; stage: number }
  | { type: "answer"; stage: number; item: number; text: string }
  | { type: "pass"; stage: number; item: number }
  | { type: "clue"; stage: number; item: number };

export interface GameEvent {
  type: "answer" | "pass" | "clue" | "start_stage" | "timeout";
  stage: number;
  stageKind: StageKind;
  item: number | null;
  outcome: "correct" | "wrong" | "passed" | "clue" | "started" | "timeout";
  given: string | null;
  points: number;
  /** Respuesta correcta revelada (solo cuando el elemento queda cerrado). */
  revealedAnswer: string | null;
  /** Lectura del reloj cuando se registró la acción. */
  clockMs: number | null;
}

export function soloRulesFor(mode: GameMode, timing: TimingConfig): SoloRules {
  const phaseTimeMs = {} as Record<PhaseKind, number>;
  const phaseItems = {} as Record<PhaseKind, number>;
  for (const kind of Object.keys(PHASE_RULES) as PhaseKind[]) {
    phaseTimeMs[kind] = PHASE_RULES[kind].soloTimeMs;
    phaseItems[kind] = PHASE_RULES[kind].soloItems;
  }
  return {
    mode,
    roscoMs: mode === "rosco" ? timing.soloRoscoMs : timing.programRoscoBaseMs,
    intermissionTimeoutMs: timing.intermissionTimeoutMs,
    phaseTimeMs,
    phaseItems,
  };
}

function createStage(kind: StageKind, rules: SoloRules): SoloStage {
  if (kind === "rosco") {
    const rosco = createRosco();
    return {
      kind,
      status: "locked",
      startedAt: null,
      endedAt: null,
      timeLimitMs: rules.roscoMs,
      endReason: null,
      items: [],
      rosco,
      roscoGiven: rosco.statuses.map(() => null),
    };
  }
  return {
    kind,
    status: "locked",
    startedAt: null,
    endedAt: null,
    timeLimitMs: rules.phaseTimeMs[kind],
    endReason: null,
    items: createPhaseItems(kind, rules.phaseItems[kind]),
    rosco: null,
    roscoGiven: null,
  };
}

/** Crea una partida y pone en marcha la primera prueba en `now`. */
export function createSoloState(rules: SoloRules, now: number): SoloState {
  const stages = stagesForMode(rules.mode).map((k) => createStage(k, rules));
  const first = stages[0]!;
  stages[0] = { ...first, status: "playing", startedAt: now };
  return {
    schema: 1,
    mode: rules.mode,
    rules,
    status: "in_progress",
    stageIndex: 0,
    stages,
    readySince: null,
    createdAt: now,
    finishedAt: null,
  };
}

function cloneState(state: SoloState): SoloState {
  return { ...state, stages: state.stages.slice() };
}

function earnedBonusMs(state: SoloState): number {
  return state.stages.reduce((acc, s) => (s.kind === "rosco" ? acc : acc + sumPhase(s.items).bonusMs), 0);
}

function advance(state: SoloState, at: number): void {
  if (state.stageIndex < state.stages.length - 1) {
    state.stageIndex += 1;
    const next = state.stages[state.stageIndex]!;
    state.stages[state.stageIndex] = { ...next, status: "ready" };
    state.readySince = at;
  } else {
    state.status = "completed";
    state.finishedAt = at;
    state.readySince = null;
  }
}

function closeStage(stage: SoloStage, at: number, reason: StageEndReason): SoloStage {
  return {
    ...stage,
    status: "done",
    endedAt: at,
    endReason: reason,
    items: stage.items.map((i) => (i.outcome === "pending" ? { ...i, outcome: "timeout" as const } : i)),
  };
}

/**
 * Aplica las transiciones que dependen solo del tiempo: fin del reloj de la
 * prueba en curso y abandono por inactividad entre pruebas.
 */
export function settleSolo(input: SoloState, now: number): { state: SoloState; events: GameEvent[] } {
  let state = input;
  const events: GameEvent[] = [];
  for (let guard = 0; guard < 10 && state.status === "in_progress"; guard++) {
    const stage = state.stages[state.stageIndex]!;
    if (stage.status === "playing" && stage.startedAt !== null && now >= stage.startedAt + stage.timeLimitMs) {
      const at = stage.startedAt + stage.timeLimitMs;
      state = cloneState(state);
      state.stages[state.stageIndex] = closeStage(stage, at, "timeout");
      events.push({
        type: "timeout",
        stage: state.stageIndex,
        stageKind: stage.kind,
        item: null,
        outcome: "timeout",
        given: null,
        points: 0,
        revealedAnswer: null,
        clockMs: 0,
      });
      advance(state, at);
      continue;
    }
    if (
      stage.status === "ready" &&
      state.readySince !== null &&
      now - state.readySince > state.rules.intermissionTimeoutMs
    ) {
      const at = state.readySince + state.rules.intermissionTimeoutMs;
      state = cloneState(state);
      for (let i = state.stageIndex; i < state.stages.length; i++) {
        state.stages[i] = closeStage(state.stages[i]!, at, "abandoned");
      }
      state.status = "abandoned";
      state.finishedAt = at;
      state.readySince = null;
    }
    break;
  }
  return { state, events };
}

function stageRemainingMs(stage: SoloStage, now: number): number {
  if (stage.startedAt === null) return stage.timeLimitMs;
  return Math.max(0, stage.timeLimitMs - Math.max(0, now - stage.startedAt));
}

/** Aplica una acción del jugador. Lanza GameRuleError si no es válida. */
export function applySoloAction(
  input: SoloState,
  action: SoloAction,
  content: QuestionSet,
  now: number,
): { state: SoloState; event: GameEvent; settleEvents: GameEvent[] } {
  const settled = settleSolo(input, now);
  const state = cloneState(settled.state);
  if (state.status !== "in_progress") throw new GameRuleError("finished");
  if (action.stage !== state.stageIndex) throw new GameRuleError("stale");
  const stage = state.stages[state.stageIndex]!;

  if (action.type === "start_stage") {
    if (stage.status !== "ready") throw new GameRuleError("invalid_action");
    const timeLimitMs = stage.kind === "rosco" && state.mode === "program" ? state.rules.roscoMs + earnedBonusMs(state) : stage.timeLimitMs;
    state.stages[state.stageIndex] = { ...stage, status: "playing", startedAt: now, timeLimitMs };
    state.readySince = null;
    return {
      state,
      settleEvents: settled.events,
      event: {
        type: "start_stage",
        stage: state.stageIndex,
        stageKind: stage.kind,
        item: null,
        outcome: "started",
        given: null,
        points: 0,
        revealedAnswer: null,
        clockMs: timeLimitMs,
      },
    };
  }

  if (stage.status !== "playing") throw new GameRuleError("invalid_action");
  const clockMs = stageRemainingMs(stage, now);

  if (stage.kind === "rosco") {
    const rosco = stage.rosco!;
    if (rosco.cursor === null || action.item !== rosco.cursor) throw new GameRuleError("stale");
    if (action.type === "clue") throw new GameRuleError("invalid_action");
    const question = content.rosco[action.item];
    if (!question) throw new GameRuleError("invalid_action", "Pregunta inexistente");
    const given = action.type === "answer" ? sanitizeGivenAnswer(action.text) : null;
    const outcome =
      action.type === "pass" ? "passed" : isCorrectAnswer(given ?? "", question.answers) ? "correct" : "wrong";
    const nextRosco = applyRoscoOutcome(rosco, action.item, outcome);
    const roscoGiven = (stage.roscoGiven ?? []).slice();
    if (given !== null) roscoGiven[action.item] = given;
    let nextStage: SoloStage = { ...stage, rosco: nextRosco, roscoGiven };
    if (nextRosco.cursor === null) nextStage = closeStage(nextStage, now, "completed");
    state.stages[state.stageIndex] = nextStage;
    if (nextStage.status === "done") advance(state, now);
    return {
      state,
      settleEvents: settled.events,
      event: {
        type: action.type,
        stage: action.stage,
        stageKind: "rosco",
        item: action.item,
        outcome,
        given,
        points: outcome === "correct" ? 10 : outcome === "wrong" ? -5 : 0,
        revealedAnswer: outcome === "passed" ? null : (question.answers[0] ?? null),
        clockMs,
      },
    };
  }

  const kind = stage.kind;
  const current = currentItemIndex(stage.items);
  if (current === null || action.item !== current) throw new GameRuleError("stale");
  const question = content[kind][current];
  if (!question) throw new GameRuleError("invalid_action", "Pregunta inexistente");
  const items = stage.items.slice();
  const item = items[current]!;

  if (action.type === "clue") {
    if (!canRevealClue(kind, item)) throw new GameRuleError("invalid_action", "No quedan más pistas");
    items[current] = revealClue(kind, item);
    state.stages[state.stageIndex] = { ...stage, items };
    return {
      state,
      settleEvents: settled.events,
      event: {
        type: "clue",
        stage: action.stage,
        stageKind: kind,
        item: current,
        outcome: "clue",
        given: null,
        points: 0,
        revealedAnswer: null,
        clockMs,
      },
    };
  }

  const given = action.type === "answer" ? sanitizeGivenAnswer(action.text) : null;
  const outcome =
    action.type === "pass" ? "passed" : isCorrectAnswer(given ?? "", question.answers) ? "correct" : "wrong";
  items[current] = resolveItem(kind, item, outcome, given);
  let nextStage: SoloStage = { ...stage, items };
  if (currentItemIndex(items) === null) nextStage = closeStage(nextStage, now, "completed");
  state.stages[state.stageIndex] = nextStage;
  if (nextStage.status === "done") advance(state, now);
  return {
    state,
    settleEvents: settled.events,
    event: {
      type: action.type,
      stage: action.stage,
      stageKind: kind,
      item: current,
      outcome,
      given,
      points: items[current]!.points,
      revealedAnswer: question.answers[0] ?? null,
      clockMs,
    },
  };
}

export interface SoloSummary {
  mode: GameMode;
  status: SoloStatus;
  phasePoints: number;
  phaseCorrect: number;
  bonusMs: number;
  rosco: RoscoCounts;
  roscoPoints: number;
  roscoTimeUsedMs: number;
  roscoRemainingMs: number;
  totalTimeUsedMs: number;
  score: number;
  roscoComplete: boolean;
  perfect: boolean;
}

/** Resumen y puntuación final calculados a partir del estado verificado. */
export function soloSummary(state: SoloState, now: number): SoloSummary {
  let phasePoints = 0;
  let phaseCorrect = 0;
  let bonusMs = 0;
  let totalTimeUsedMs = 0;
  let roscoTimeUsedMs = 0;
  let roscoRemainingMs = 0;
  let rosco: RoscoCounts = { correct: 0, wrong: 0, passed: 0, pending: 27, open: 27 };
  for (const stage of state.stages) {
    if (stage.startedAt !== null) {
      const end = stage.endedAt ?? now;
      totalTimeUsedMs += Math.min(stage.timeLimitMs, Math.max(0, end - stage.startedAt));
    }
    if (stage.kind === "rosco") {
      rosco = roscoCounts(stage.rosco!);
      if (stage.startedAt !== null) {
        const end = stage.endedAt ?? now;
        roscoTimeUsedMs = Math.min(stage.timeLimitMs, Math.max(0, end - stage.startedAt));
        roscoRemainingMs = stage.timeLimitMs - roscoTimeUsedMs;
      } else {
        roscoRemainingMs = 0;
      }
    } else {
      const sum = sumPhase(stage.items);
      phasePoints += sum.points;
      phaseCorrect += sum.correct;
      bonusMs += sum.bonusMs;
    }
  }
  const rPoints = roscoPoints({
    correct: rosco.correct,
    wrong: rosco.wrong,
    open: rosco.open,
    remainingMs: state.status === "in_progress" ? 0 : roscoRemainingMs,
  });
  return {
    mode: state.mode,
    status: state.status,
    phasePoints,
    phaseCorrect,
    bonusMs,
    rosco,
    roscoPoints: rPoints,
    roscoTimeUsedMs,
    roscoRemainingMs,
    totalTimeUsedMs,
    score: phasePoints + rPoints,
    roscoComplete: rosco.open === 0,
    perfect: rosco.correct === 27,
  };
}

export function currentStage(state: SoloState): SoloStage {
  return state.stages[state.stageIndex]!;
}
