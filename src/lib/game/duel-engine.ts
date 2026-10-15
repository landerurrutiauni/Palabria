/**
 * Motor del duelo 1 vs 1 por turnos.
 *
 * Invariantes:
 *  - Solo existe un turno activo (`turnSeat`) y un único reloj en marcha
 *    (`turnStartedAt`), por construcción: el estado no puede representar
 *    dos relojes activos.
 *  - Cada jugador tiene su banco de tiempo (`bankMs`), que solo se descuenta
 *    durante sus turnos. Al cambiar de turno se detiene (se guarda lo que
 *    queda) y al recuperar el turno se reanuda desde ese valor.
 *  - Acierto: el turno continúa y el reloj sigue corriendo.
 *  - Fallo o «Pasapalabra»: se detiene el reloj propio y arranca el del rival.
 *
 * Las funciones son puras: el servidor carga el estado, aplica la acción con
 * su propio reloj y persiste el resultado de forma atómica.
 */
import type { TimingConfig } from "./config";
import type { PhaseKind, QuestionSet, StageKind } from "./content-types";
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
import { duelWinner, otherSeat, type Seat } from "./ranking";
import { applyRoscoOutcome, createRosco, roscoCounts, type RoscoProgress } from "./rosco";
import type { GameEvent } from "./solo-engine";

export type { Seat } from "./ranking";

export type DuelStatus = "in_progress" | "completed" | "abandoned";
export type DuelPlayerStatus = "playing" | "finished" | "out_of_time" | "abandoned";
export type DuelEndReason = "completed" | "abandoned";

export interface DuelRules {
  mode: GameMode;
  /** Tiempo de rosco de cada jugador (en programa: base a la que se suman los segundos ganados). */
  roscoBaseMs: number;
  reconnectGraceMs: number;
  startDelayMs: number;
  stageGapMs: number;
  itemsPerPlayer: Record<PhaseKind, number>;
  shotClockMs: Record<PhaseKind, number>;
}

export interface DuelPlayer {
  seat: Seat;
  status: DuelPlayerStatus;
  /** Tiempo de rosco restante en la última parada del reloj. */
  bankMs: number;
  bonusMs: number;
  phasePoints: number;
  /** Tiempo de rosco consumido. */
  timeUsedMs: number;
  phases: Record<PhaseKind, PhaseItemProgress[]>;
  rosco: RoscoProgress;
  roscoGiven: (string | null)[];
  lastSeenAt: number;
}

export interface DuelState {
  schema: 1;
  mode: GameMode;
  rules: DuelRules;
  status: DuelStatus;
  stages: StageKind[];
  stageIndex: number;
  turnSeat: Seat | null;
  /** Inicio del turno actual (puede ser futuro durante la cuenta atrás). */
  turnStartedAt: number | null;
  turnNumber: number;
  players: Record<Seat, DuelPlayer>;
  winnerSeat: Seat | null;
  endReason: DuelEndReason | null;
  startedAt: number;
  finishedAt: number | null;
}

export type DuelAction =
  | { type: "answer"; stage: number; item: number; text: string }
  | { type: "pass"; stage: number; item: number }
  | { type: "clue"; stage: number; item: number };

export interface DuelEvent extends GameEvent {
  seat: Seat;
  /** El turno pasa al rival (o termina la prueba) tras esta acción. */
  turnChanged: boolean;
}

export function duelRulesFor(mode: GameMode, timing: TimingConfig): DuelRules {
  const itemsPerPlayer = {} as Record<PhaseKind, number>;
  const shotClockMs = {} as Record<PhaseKind, number>;
  for (const kind of Object.keys(PHASE_RULES) as PhaseKind[]) {
    itemsPerPlayer[kind] = PHASE_RULES[kind].duelItemsPerPlayer;
    shotClockMs[kind] = PHASE_RULES[kind].duelShotClockMs;
  }
  return {
    mode,
    roscoBaseMs: mode === "rosco" ? timing.duelRoscoMs : timing.duelProgramRoscoBaseMs,
    reconnectGraceMs: timing.reconnectGraceMs,
    startDelayMs: timing.duelStartDelayMs,
    stageGapMs: timing.duelStageGapMs,
    itemsPerPlayer,
    shotClockMs,
  };
}

function createPlayer(seat: Seat, rules: DuelRules, now: number): DuelPlayer {
  const rosco = createRosco();
  const phases = {} as Record<PhaseKind, PhaseItemProgress[]>;
  for (const kind of Object.keys(PHASE_RULES) as PhaseKind[]) {
    phases[kind] = rules.mode === "program" ? createPhaseItems(kind, rules.itemsPerPlayer[kind]) : [];
  }
  return {
    seat,
    status: "playing",
    bankMs: rules.roscoBaseMs,
    bonusMs: 0,
    phasePoints: 0,
    timeUsedMs: 0,
    phases,
    rosco,
    roscoGiven: rosco.statuses.map(() => null),
    lastSeenAt: now,
  };
}

/**
 * Regla determinista del primer turno:
 *  - En las pruebas previas se alterna quién empieza (empieza el invitado en la primera).
 *  - En El Rosco empieza quien tenga menos tiempo; si empatan, el invitado (asiento 2).
 */
function firstSeatForStage(state: Pick<DuelState, "stages" | "players">, stageIndex: number): Seat {
  const kind = state.stages[stageIndex];
  if (kind === "rosco") {
    const a = state.players[1].bankMs;
    const b = state.players[2].bankMs;
    if (a !== b) return a < b ? 1 : 2;
    return 2;
  }
  return stageIndex % 2 === 0 ? 2 : 1;
}

/** Crea el estado inicial del duelo; el primer reloj arranca tras la cuenta atrás. */
export function createDuelState(rules: DuelRules, now: number): DuelState {
  const stages = [...stagesForMode(rules.mode)];
  const players: Record<Seat, DuelPlayer> = { 1: createPlayer(1, rules, now), 2: createPlayer(2, rules, now) };
  const base = { stages, players };
  return {
    schema: 1,
    mode: rules.mode,
    rules,
    status: "in_progress",
    stages,
    stageIndex: 0,
    turnSeat: firstSeatForStage(base, 0),
    turnStartedAt: now + rules.startDelayMs,
    turnNumber: 1,
    players,
    winnerSeat: null,
    endReason: null,
    startedAt: now,
    finishedAt: null,
  };
}

function clone(state: DuelState): DuelState {
  return { ...state, players: { 1: { ...state.players[1] }, 2: { ...state.players[2] } } };
}

export function stageKindOf(state: DuelState): StageKind {
  return state.stages[state.stageIndex]!;
}

function canPlayStage(state: DuelState, seat: Seat): boolean {
  const kind = stageKindOf(state);
  const p = state.players[seat];
  if (p.status === "abandoned") return false;
  if (kind === "rosco") return p.status === "playing";
  return currentItemIndex(p.phases[kind]) !== null;
}

/** Tiempo de rosco restante de un jugador en `now` (si es su turno, descontando). */
export function playerRemainingMs(state: DuelState, seat: Seat, now: number): number {
  const p = state.players[seat];
  if (stageKindOf(state) !== "rosco") return p.bankMs;
  if (state.status === "in_progress" && state.turnSeat === seat && state.turnStartedAt !== null) {
    return Math.max(0, p.bankMs - Math.max(0, now - state.turnStartedAt));
  }
  return p.bankMs;
}

/** Tiempo restante del turno en una prueba previa (reloj de jugada). */
export function shotClockRemainingMs(state: DuelState, now: number): number {
  const kind = stageKindOf(state);
  if (kind === "rosco" || state.turnStartedAt === null) return 0;
  const limit = state.rules.shotClockMs[kind];
  return Math.max(0, limit - Math.max(0, now - state.turnStartedAt));
}

/** Detiene el reloj de rosco del jugador activo y acumula el tiempo consumido. */
function stopActiveRoscoClock(state: DuelState, now: number): void {
  if (stageKindOf(state) !== "rosco" || state.turnSeat === null || state.turnStartedAt === null) return;
  const seat = state.turnSeat;
  const p = state.players[seat];
  const elapsed = Math.min(p.bankMs, Math.max(0, now - state.turnStartedAt));
  state.players[seat] = { ...p, bankMs: p.bankMs - elapsed, timeUsedMs: p.timeUsedMs + elapsed };
  state.turnStartedAt = null;
}

function finishDuel(state: DuelState, now: number): void {
  const line = (seat: Seat) => {
    const c = roscoCounts(state.players[seat].rosco);
    return { correct: c.correct, wrong: c.wrong, timeUsedMs: state.players[seat].timeUsedMs };
  };
  state.status = "completed";
  state.endReason = "completed";
  state.winnerSeat = duelWinner(line(1), line(2));
  state.turnSeat = null;
  state.turnStartedAt = null;
  state.finishedAt = now;
}

function startStage(state: DuelState, index: number, now: number): void {
  state.stageIndex = index;
  if (index >= state.stages.length) {
    state.stageIndex = state.stages.length - 1;
    finishDuel(state, now);
    return;
  }
  if (state.stages[index] === "rosco") {
    for (const seat of [1, 2] as Seat[]) {
      const p = state.players[seat];
      if (p.status === "abandoned") continue;
      state.players[seat] = { ...p, bankMs: state.rules.roscoBaseMs + p.bonusMs, status: "playing" };
    }
  }
  state.turnSeat = firstSeatForStage(state, index);
  state.turnStartedAt = now + state.rules.stageGapMs;
  state.turnNumber += 1;
}

/**
 * Cede el turno tras una acción de `from` (el reloj de `from` ya está detenido).
 * Si el rival no puede jugar, `from` continúa; si nadie puede, termina la prueba.
 */
function passTurn(state: DuelState, from: Seat, now: number): void {
  const to = otherSeat(from);
  if (canPlayStage(state, to)) {
    state.turnSeat = to;
    state.turnStartedAt = now;
    state.turnNumber += 1;
  } else if (canPlayStage(state, from)) {
    state.turnSeat = from;
    state.turnStartedAt = now;
    state.turnNumber += 1;
  } else {
    startStage(state, state.stageIndex + 1, now);
  }
}

function abandon(state: DuelState, seat: Seat, now: number): void {
  if (state.turnSeat === seat) stopActiveRoscoClock(state, now);
  state.players[seat] = { ...state.players[seat], status: "abandoned" };
  const rival = otherSeat(seat);
  state.status = "abandoned";
  state.endReason = "abandoned";
  state.winnerSeat = state.players[rival].status === "abandoned" ? null : rival;
  state.turnSeat = null;
  state.turnStartedAt = null;
  state.finishedAt = now;
}

function timeoutEvent(
  seat: Seat,
  stage: number,
  stageKind: StageKind,
  item: number | null,
  answer: string | null,
): DuelEvent {
  return {
    type: "timeout",
    seat,
    stage,
    stageKind,
    item,
    outcome: "timeout",
    given: null,
    points: 0,
    revealedAnswer: answer,
    clockMs: 0,
    turnChanged: true,
  };
}

/**
 * Transiciones dependientes del tiempo: fin de cuenta atrás, reloj agotado,
 * tiempo de jugada agotado en las pruebas previas y abandono por desconexión.
 * `content` permite registrar la solución de los elementos que caducan.
 */
export function settleDuel(
  input: DuelState,
  now: number,
  content?: Record<Seat, QuestionSet>,
): { state: DuelState; events: DuelEvent[] } {
  let state = input;
  const events: DuelEvent[] = [];
  for (let guard = 0; guard < 50; guard++) {
    if (state.status !== "in_progress" || state.turnSeat === null || state.turnStartedAt === null) break;
    if (now < state.turnStartedAt) break;
    const seat = state.turnSeat;
    const player = state.players[seat];
    const kind = stageKindOf(state);

    const lastPresence = Math.max(player.lastSeenAt, state.turnStartedAt);
    if (now - lastPresence > state.rules.reconnectGraceMs) {
      state = clone(state);
      abandon(state, seat, Math.min(now, lastPresence + state.rules.reconnectGraceMs));
      break;
    }

    if (kind === "rosco") {
      const expiry = state.turnStartedAt + player.bankMs;
      if (now < expiry) break;
      state = clone(state);
      state.players[seat] = {
        ...player,
        timeUsedMs: player.timeUsedMs + player.bankMs,
        bankMs: 0,
        status: "out_of_time",
      };
      state.turnStartedAt = null;
      events.push(timeoutEvent(seat, state.stageIndex, kind, player.rosco.cursor, null));
      passTurn(state, seat, now);
      continue;
    }

    const expiry = state.turnStartedAt + state.rules.shotClockMs[kind];
    if (now < expiry) break;
    state = clone(state);
    const items = player.phases[kind].slice();
    const idx = currentItemIndex(items);
    if (idx !== null) {
      items[idx] = resolveItem(kind, items[idx]!, "timeout", null);
      state.players[seat] = { ...player, phases: { ...player.phases, [kind]: items } };
      const answer = content?.[seat]?.[kind]?.[idx]?.answers[0] ?? null;
      events.push(timeoutEvent(seat, state.stageIndex, kind, idx, answer));
    }
    passTurn(state, seat, now);
  }
  return { state, events };
}

/** Aplica la acción del jugador `seat`. Rechaza acciones fuera de turno o caducadas. */
export function applyDuelAction(
  input: DuelState,
  seat: Seat,
  action: DuelAction,
  content: Record<Seat, QuestionSet>,
  now: number,
): { state: DuelState; event: DuelEvent; settleEvents: DuelEvent[] } {
  const settled = settleDuel(input, now, content);
  if (settled.state.status !== "in_progress") throw new GameRuleError("finished");
  const state = clone(settled.state);
  if (state.turnSeat !== seat) throw new GameRuleError("not_your_turn");
  if (state.turnStartedAt === null || now < state.turnStartedAt) throw new GameRuleError("not_started");
  if (action.stage !== state.stageIndex) throw new GameRuleError("stale");
  const kind = stageKindOf(state);
  const player = state.players[seat];
  const set = content[seat];

  if (kind === "rosco") {
    if (player.status !== "playing") throw new GameRuleError("not_playing");
    if (action.type === "clue") throw new GameRuleError("invalid_action");
    const cursor = player.rosco.cursor;
    if (cursor === null || action.item !== cursor) throw new GameRuleError("stale");
    const question = set.rosco[cursor];
    if (!question) throw new GameRuleError("invalid_action", "Pregunta inexistente");
    const clockMs = playerRemainingMs(state, seat, now);
    if (clockMs <= 0) throw new GameRuleError("time_up");

    const given = action.type === "answer" ? sanitizeGivenAnswer(action.text) : null;
    const outcome =
      action.type === "pass" ? "passed" : isCorrectAnswer(given ?? "", question.answers) ? "correct" : "wrong";
    const rosco = applyRoscoOutcome(player.rosco, cursor, outcome);
    const roscoGiven = player.roscoGiven.slice();
    if (given !== null) roscoGiven[cursor] = given;
    state.players[seat] = { ...player, rosco, roscoGiven };

    let turnChanged = false;
    const resolvedAll = rosco.cursor === null;
    if (outcome !== "correct" || resolvedAll) {
      // Fallo, «Pasapalabra» o rosco terminado: se detiene el reloj del jugador.
      stopActiveRoscoClock(state, now);
      if (resolvedAll) state.players[seat] = { ...state.players[seat], status: "finished" };
      passTurn(state, seat, now);
      turnChanged = state.turnSeat !== seat;
    }
    return {
      state,
      settleEvents: settled.events,
      event: {
        type: action.type,
        seat,
        stage: action.stage,
        stageKind: "rosco",
        item: cursor,
        outcome,
        given,
        points: 0,
        revealedAnswer: outcome === "passed" ? null : (question.answers[0] ?? null),
        clockMs,
        turnChanged,
      },
    };
  }

  const items = player.phases[kind].slice();
  const idx = currentItemIndex(items);
  if (idx === null || action.item !== idx) throw new GameRuleError("stale");
  const question = set[kind][idx];
  if (!question) throw new GameRuleError("invalid_action", "Pregunta inexistente");
  const clockMs = shotClockRemainingMs(state, now);

  if (action.type === "clue") {
    if (!canRevealClue(kind, items[idx]!)) throw new GameRuleError("invalid_action", "No quedan más pistas");
    items[idx] = revealClue(kind, items[idx]!);
    state.players[seat] = { ...player, phases: { ...player.phases, [kind]: items } };
    return {
      state,
      settleEvents: settled.events,
      event: {
        type: "clue",
        seat,
        stage: action.stage,
        stageKind: kind,
        item: idx,
        outcome: "clue",
        given: null,
        points: 0,
        revealedAnswer: null,
        clockMs,
        turnChanged: false,
      },
    };
  }

  const given = action.type === "answer" ? sanitizeGivenAnswer(action.text) : null;
  const outcome =
    action.type === "pass" ? "passed" : isCorrectAnswer(given ?? "", question.answers) ? "correct" : "wrong";
  items[idx] = resolveItem(kind, items[idx]!, outcome, given);
  const phases = { ...player.phases, [kind]: items };
  let bonusMs = 0;
  let phasePoints = 0;
  for (const k of Object.keys(phases) as PhaseKind[]) {
    const sum = sumPhase(phases[k]);
    bonusMs += sum.bonusMs;
    phasePoints += sum.points;
  }
  state.players[seat] = { ...player, phases, bonusMs, phasePoints };
  state.turnStartedAt = null;
  passTurn(state, seat, now);
  return {
    state,
    settleEvents: settled.events,
    event: {
      type: action.type,
      seat,
      stage: action.stage,
      stageKind: kind,
      item: idx,
      outcome,
      given,
      points: items[idx]!.points,
      revealedAnswer: question.answers[0] ?? null,
      clockMs,
      turnChanged: state.turnSeat !== seat,
    },
  };
}

/** Registra actividad del jugador (latido de conexión). */
export function touchPlayer(state: DuelState, seat: Seat, now: number): DuelState {
  const next = clone(state);
  next.players[seat] = { ...next.players[seat], lastSeenAt: Math.max(next.players[seat].lastSeenAt, now) };
  return next;
}

export interface DuelLine {
  correct: number;
  wrong: number;
  passed: number;
  open: number;
  timeUsedMs: number;
  phasePoints: number;
  bonusMs: number;
}

export function duelLine(state: DuelState, seat: Seat): DuelLine {
  const p = state.players[seat];
  const c = roscoCounts(p.rosco);
  return {
    correct: c.correct,
    wrong: c.wrong,
    passed: c.passed,
    open: c.open,
    timeUsedMs: p.timeUsedMs,
    phasePoints: p.phasePoints,
    bonusMs: p.bonusMs,
  };
}

export function duelOutcomeFor(state: DuelState, seat: Seat): "win" | "loss" | "draw" | null {
  if (state.status === "in_progress") return null;
  if (state.winnerSeat === null) return "draw";
  return state.winnerSeat === seat ? "win" : "loss";
}
