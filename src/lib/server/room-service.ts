/**
 * Salas privadas 1 vs 1.
 *
 * Estados de la sala (validados en el servidor):
 *   waiting → ready → in_progress → completed | abandoned
 *   waiting | ready → expired (caducidad, cambio de día o cancelación)
 *
 * Reglas de intentos: crear una sala no consume nada; el intento 1 vs 1 de
 * ambos jugadores se consume en la misma transacción que inicia la partida
 * (restricción única por identidad, día y tipo). Si esa transacción falla no
 * se consume ningún intento, de modo que nunca quedan reservas colgadas.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { ALPHABET } from "@/lib/game/alphabet";
import { timingFromEnv } from "@/lib/game/config";
import type { PhaseKind, QuestionSet, StageKind } from "@/lib/game/content-types";
import { formatShortDate, nextChallengeStart } from "@/lib/game/daily";
import {
  applyDuelAction,
  createDuelState,
  duelLine,
  duelOutcomeFor,
  duelRulesFor,
  settleDuel,
  stageKindOf,
  type DuelAction,
  type DuelEvent,
  type DuelPlayer,
  type DuelRules,
  type DuelState,
  type Seat,
} from "@/lib/game/duel-engine";
import { GameRuleError } from "@/lib/game/errors";
import { currentItemIndex, type PhaseItemProgress } from "@/lib/game/phase-items";
import { PHASE_RULES, modeLabel, stageTitle, type GameMode } from "@/lib/game/phases";
import { createRosco, roscoCounts, type RoscoProgress } from "@/lib/game/rosco";
import type {
  DuelLastAction,
  DuelPlayerView,
  DuelResultView,
  DuelView,
  FeedbackView,
  ParticipantStatus,
  RoomStatus,
} from "@/lib/views";
import { getChallengeForDate, loadQuestionSet, todayKey } from "./challenges";
import { serverNow } from "./clock";
import { defaultDatabase, isUniqueViolation, type Database, type Queryable } from "./db-core";
import { AppError, Errors } from "./errors";
import type { Player } from "./players";
import { publishRoomUpdate } from "./realtime";
import { recordDuelResults } from "./results";
import { fullLetters, lettersView, phasePrompt, phaseReview, roscoPrompt } from "./view-helpers";

/** Una conexión se considera activa si ha dado señales en los últimos segundos. */
export const PRESENCE_WINDOW_MS = 15_000;

interface RoomRow {
  id: string;
  code: string;
  challenge_id: string;
  challenge_date: string;
  mode: GameMode;
  status: RoomStatus;
  creator_id: string;
  rules: DuelRules;
  stages: StageKind[];
  stage_index: number;
  turn_seat: Seat | null;
  turn_started_at_ms: number | null;
  turn_number: number;
  winner_seat: Seat | null;
  end_reason: DuelResultView["endReason"];
  version: number;
  expires_at_ms: number;
  started_at_ms: number | null;
  finished_at_ms: number | null;
}

interface Progress {
  rosco: RoscoProgress;
  roscoGiven: (string | null)[];
  phases: Record<PhaseKind, PhaseItemProgress[]>;
}

interface ParticipantRow {
  id: string;
  room_id: string;
  player_id: string;
  seat: Seat;
  display_name: string;
  question_set: "duel_a" | "duel_b";
  is_ready: boolean;
  status: ParticipantStatus;
  time_bank_ms: number;
  bonus_ms: number;
  phase_points: number;
  time_used_ms: number;
  correct: number;
  wrong: number;
  pending: number;
  progress: Progress;
  last_seen_at_ms: number;
}

const ROOM_COLUMNS = `id, code, challenge_id, challenge_date, mode, status, creator_id, rules, stages, stage_index,
  turn_seat, turn_started_at_ms, turn_number, winner_seat, end_reason, version, expires_at_ms, started_at_ms, finished_at_ms`;
const PARTICIPANT_COLUMNS = `id, room_id, player_id, seat, display_name, question_set, is_ready, status, time_bank_ms,
  bonus_ms, phase_points, time_used_ms, correct, wrong, pending, progress, last_seen_at_ms`;

function newRoomCode(): string {
  return randomBytes(12).toString("base64url");
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{12,40}$/.test(code);
}

function initialProgress(rules: DuelRules): Progress {
  const rosco = createRosco();
  const phases = {} as Record<PhaseKind, PhaseItemProgress[]>;
  for (const kind of Object.keys(PHASE_RULES) as PhaseKind[]) phases[kind] = [];
  void rules;
  return { rosco, roscoGiven: rosco.statuses.map(() => null), phases };
}

async function lockRoomByCode(tx: Queryable, code: string): Promise<RoomRow> {
  const res = await tx.query<RoomRow>(`select ${ROOM_COLUMNS} from multiplayer_rooms where code = $1 for update`, [
    code,
  ]);
  const room = res.rows[0];
  if (!room) throw Errors.roomNotFound();
  return room;
}

async function loadParticipants(tx: Queryable, roomId: string, lock = false): Promise<ParticipantRow[]> {
  const res = await tx.query<ParticipantRow>(
    `select ${PARTICIPANT_COLUMNS} from multiplayer_participants where room_id = $1 order by seat ${lock ? "for update" : ""}`,
    [roomId],
  );
  return res.rows;
}

function toDuelState(room: RoomRow, parts: ParticipantRow[]): DuelState {
  const players = {} as Record<Seat, DuelPlayer>;
  for (const p of parts) {
    players[p.seat] = {
      seat: p.seat,
      status: p.status === "joined" ? "playing" : p.status,
      bankMs: p.time_bank_ms,
      bonusMs: p.bonus_ms,
      phasePoints: p.phase_points,
      timeUsedMs: p.time_used_ms,
      phases: p.progress.phases,
      rosco: p.progress.rosco,
      roscoGiven: p.progress.roscoGiven,
      lastSeenAt: Number(p.last_seen_at_ms),
    };
  }
  return {
    schema: 1,
    mode: room.mode,
    rules: room.rules,
    status: room.status === "in_progress" ? "in_progress" : room.status === "abandoned" ? "abandoned" : "completed",
    stages: room.stages,
    stageIndex: room.stage_index,
    turnSeat: room.turn_seat,
    turnStartedAt: room.turn_started_at_ms === null ? null : Number(room.turn_started_at_ms),
    turnNumber: room.turn_number,
    players,
    winnerSeat: room.winner_seat,
    endReason: room.end_reason === "abandoned" ? "abandoned" : room.end_reason === "completed" ? "completed" : null,
    startedAt: Number(room.started_at_ms ?? 0),
    finishedAt: room.finished_at_ms === null ? null : Number(room.finished_at_ms),
  };
}

async function persistDuel(tx: Queryable, room: RoomRow, parts: ParticipantRow[], state: DuelState): Promise<RoomRow> {
  const res = await tx.query<RoomRow>(
    `update multiplayer_rooms set
        status = $2, stage_index = $3, turn_seat = $4, turn_started_at_ms = $5, turn_number = $6,
        winner_seat = $7, end_reason = $8, finished_at_ms = $9, version = version + 1, updated_at = now()
      where id = $1
      returning ${ROOM_COLUMNS}`,
    [
      room.id,
      state.status,
      state.stageIndex,
      state.turnSeat,
      state.turnStartedAt,
      state.turnNumber,
      state.winnerSeat,
      state.endReason,
      state.finishedAt,
    ],
  );
  for (const p of parts) {
    const pl = state.players[p.seat];
    const counts = roscoCounts(pl.rosco);
    await tx.query(
      `update multiplayer_participants set
          status = $2, time_bank_ms = $3, bonus_ms = $4, phase_points = $5, time_used_ms = $6,
          correct = $7, wrong = $8, pending = $9, progress = $10,
          last_seen_at_ms = greatest(last_seen_at_ms, $11::bigint)
        where id = $1`,
      [
        p.id,
        pl.status,
        Math.max(0, Math.round(pl.bankMs)),
        pl.bonusMs,
        pl.phasePoints,
        Math.round(pl.timeUsedMs),
        counts.correct,
        counts.wrong,
        counts.open,
        JSON.stringify({ rosco: pl.rosco, roscoGiven: pl.roscoGiven, phases: pl.phases } satisfies Progress),
        pl.lastSeenAt,
      ],
    );
  }
  const updated = res.rows[0]!;
  if (state.status !== "in_progress") {
    await recordDuelResults(tx, {
      roomId: room.id,
      date: room.challenge_date,
      mode: room.mode,
      state,
      participants: parts.map((p) => ({ seat: p.seat, playerId: p.player_id, displayName: p.display_name })),
      now: state.finishedAt ?? Date.now(),
    });
  }
  return updated;
}

async function logDuelEvents(
  tx: Queryable,
  roomId: string,
  parts: ParticipantRow[],
  events: { event: DuelEvent; actionId: string }[],
): Promise<void> {
  for (const { event, actionId } of events) {
    const player = parts.find((p) => p.seat === event.seat);
    if (!player) continue;
    await tx.query(
      `insert into game_answers
         (player_id, room_id, action_id, stage_index, stage_kind, item_index, action, outcome, given_answer, clock_ms)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (player_id, action_id) do nothing`,
      [
        player.player_id,
        roomId,
        actionId,
        event.stage,
        event.stageKind,
        event.item,
        event.type,
        event.outcome,
        event.given,
        event.clockMs === null ? null : Math.round(event.clockMs),
      ],
    );
  }
}

async function loadSets(tx: Queryable, challengeId: string): Promise<Record<Seat, QuestionSet>> {
  const [a, b] = await Promise.all([
    loadQuestionSet(tx, challengeId, "duel_a"),
    loadQuestionSet(tx, challengeId, "duel_b"),
  ]);
  return { 1: a, 2: b };
}

/** Caduca una sala sin empezar si ha vencido o es de un día anterior. */
async function expireIfStale(tx: Queryable, room: RoomRow, now: number): Promise<RoomRow> {
  if (room.status !== "waiting" && room.status !== "ready") return room;
  if (now <= room.expires_at_ms && room.challenge_date === todayKey(now)) return room;
  const res = await tx.query<RoomRow>(
    `update multiplayer_rooms set status = 'expired', end_reason = 'expired', version = version + 1, updated_at = now()
      where id = $1 returning ${ROOM_COLUMNS}`,
    [room.id],
  );
  return res.rows[0]!;
}

async function duelAttemptUsed(tx: Queryable, playerId: string, date: string): Promise<boolean> {
  const res = await tx.query(
    "select 1 from daily_attempts where player_id = $1 and challenge_date = $2 and kind = 'duel'",
    [playerId, date],
  );
  return res.rowCount > 0;
}

/* ─────────────────────────────── Vistas ─────────────────────────────── */

interface ViewContext {
  room: RoomRow;
  parts: ParticipantRow[];
  state: DuelState | null;
  sets: Record<Seat, QuestionSet> | null;
  viewer: Player;
  now: number;
  lastAction: DuelLastAction | null;
  feedback: FeedbackView | null;
  canJoin: boolean;
  joinBlockedReason: string | null;
}

function playerView(ctx: ViewContext, p: ParticipantRow): DuelPlayerView {
  const { state, sets, now, room } = ctx;
  const seat = p.seat;
  const progress = state ? state.players[seat] : null;
  const rosco = progress?.rosco ?? p.progress.rosco;
  const counts = roscoCounts(rosco);
  const finished = room.status === "completed" || room.status === "abandoned";
  const kind = state ? stageKindOf(state) : room.stages[room.stage_index]!;
  const running =
    room.status === "in_progress" &&
    room.turn_seat === seat &&
    room.turn_started_at_ms !== null &&
    now >= room.turn_started_at_ms;
  const set = sets?.[seat];
  return {
    seat,
    name: p.display_name,
    isYou: p.player_id === ctx.viewer.id,
    connected: now - Number(p.last_seen_at_ms) < PRESENCE_WINDOW_MS,
    ready: p.is_ready,
    status: p.status,
    bankMs: progress?.bankMs ?? p.time_bank_ms,
    running: running && kind === "rosco",
    correct: counts.correct,
    wrong: counts.wrong,
    passed: counts.passed,
    open: counts.open,
    phasePoints: progress?.phasePoints ?? p.phase_points,
    bonusSeconds: Math.round((progress?.bonusMs ?? p.bonus_ms) / 1000),
    timeUsedMs: progress?.timeUsedMs ?? p.time_used_ms,
    letters: set
      ? lettersView(set, rosco, finished)
      : ALPHABET.map((letter) => ({ letter, mode: "starts" as const, state: "pending" as const })),
    phaseOutcomes: kind !== "rosco" && progress ? progress.phases[kind].map((x) => x.outcome) : [],
  };
}

function buildDuelView(ctx: ViewContext): DuelView {
  const { room, parts, state, sets, viewer, now } = ctx;
  const me = parts.find((p) => p.player_id === viewer.id) ?? null;
  const you = me?.seat ?? null;
  const host = parts.find((p) => p.seat === 1);
  const kind = room.stages[room.stage_index]!;
  const players: DuelView["players"] = {};
  for (const p of parts) players[p.seat] = playerView(ctx, p);

  let prompt: DuelView["prompt"] = null;
  if (state && sets && you && state.status === "in_progress" && state.turnSeat === you) {
    const pl = state.players[you];
    if (kind === "rosco") {
      if (pl.rosco.cursor !== null && pl.status === "playing")
        prompt = roscoPrompt(sets[you].rosco[pl.rosco.cursor]!, pl.rosco.cursor);
    } else {
      const idx = currentItemIndex(pl.phases[kind]);
      if (idx !== null) prompt = phasePrompt(kind, sets[you][kind][idx]!, idx, pl.phases[kind][idx]!);
    }
  }

  let result: DuelResultView | null = null;
  if ((room.status === "completed" || room.status === "abandoned" || room.status === "expired") && state && sets) {
    const rivalSeat = you ? ((you === 1 ? 2 : 1) as Seat) : null;
    const mine = you ? state.players[you] : null;
    const rival = rivalSeat ? state.players[rivalSeat] : null;
    const outcome = you && room.status !== "expired" ? duelOutcomeFor(state, you) : null;
    result = {
      outcome,
      winnerSeat: state.winnerSeat,
      endReason: room.end_reason,
      you:
        mine && you
          ? {
              letters: fullLetters(sets[you], mine.rosco, mine.roscoGiven),
              phases:
                room.mode === "program"
                  ? (["quick", "clues", "saying", "link"] as PhaseKind[]).map((k) =>
                      phaseReview(k, sets[you], mine.phases[k]),
                    )
                  : [],
            }
          : null,
      rival: rival && rivalSeat ? { letters: fullLetters(sets[rivalSeat], rival.rosco, rival.roscoGiven) } : null,
      shareText:
        you && rivalSeat && room.status !== "expired"
          ? [
              `Palabria · 1 vs 1 · ${formatShortDate(room.challenge_date)} · ${modeLabel(room.mode)}`,
              `${outcome === "win" ? "🏆 ¡Victoria!" : outcome === "loss" ? "Derrota por la mínima… o no" : "🤝 Empate"}`,
              `Yo: ✅ ${duelLine(state, you).correct} ❌ ${duelLine(state, you).wrong}`,
              `Rival: ✅ ${duelLine(state, rivalSeat).correct} ❌ ${duelLine(state, rivalSeat).wrong}`,
            ].join("\n")
          : null,
    };
  } else if (room.status === "expired") {
    result = { outcome: null, winnerSeat: null, endReason: room.end_reason, you: null, rival: null, shareText: null };
  }

  return {
    code: room.code,
    mode: room.mode,
    status: room.status,
    date: room.challenge_date,
    serverNow: now,
    version: room.version,
    you,
    isHost: you === 1,
    canJoin: ctx.canJoin,
    joinBlockedReason: ctx.joinBlockedReason,
    hostName: host?.display_name ?? "Anfitrión",
    expiresAt: room.status === "waiting" || room.status === "ready" ? room.expires_at_ms : null,
    stages: room.stages,
    stage: {
      index: room.stage_index,
      kind,
      title: stageTitle(kind),
      howTo:
        kind === "rosco"
          ? "Acierto: sigues jugando. Fallo o «Palabria»: tu reloj se detiene y empieza a correr el de tu rival."
          : PHASE_RULES[kind].howTo,
      itemsPerPlayer: kind === "rosco" ? 27 : room.rules.itemsPerPlayer[kind],
    },
    turn: {
      seat: room.turn_seat,
      startedAt: room.turn_started_at_ms,
      shotClockMs: kind === "rosco" ? null : room.rules.shotClockMs[kind],
      number: room.turn_number,
    },
    players,
    prompt,
    feedback: ctx.feedback,
    lastAction: ctx.lastAction,
    rules: {
      roscoSeconds: Math.round(room.rules.roscoBaseMs / 1000),
      graceSeconds: Math.round(room.rules.reconnectGraceMs / 1000),
      shotClocks: Object.fromEntries(
        (Object.keys(room.rules.shotClockMs) as PhaseKind[]).map((k) => [
          k,
          Math.round(room.rules.shotClockMs[k] / 1000),
        ]),
      ) as Record<PhaseKind, number>,
    },
    result,
  };
}

async function lastActions(
  db: Queryable,
  room: RoomRow,
  parts: ParticipantRow[],
  viewer: Player,
  sets: Record<Seat, QuestionSet> | null,
): Promise<{ lastAction: DuelLastAction | null; feedback: FeedbackView | null }> {
  if (room.status === "waiting" || room.status === "ready" || room.status === "expired") {
    return { lastAction: null, feedback: null };
  }
  const res = await db.query<{
    player_id: string;
    stage_kind: StageKind;
    item_index: number | null;
    outcome: FeedbackView["outcome"];
    given_answer: string | null;
    at_ms: number;
  }>(
    `select player_id, stage_kind, item_index, outcome, given_answer,
            (extract(epoch from created_at) * 1000)::bigint as at_ms
       from game_answers where room_id = $1 and outcome <> 'clue'
      order by id desc limit 6`,
    [room.id],
  );
  const seatOf = (pid: string) => parts.find((p) => p.player_id === pid)?.seat ?? null;
  const latest = res.rows[0];
  const lastAction: DuelLastAction | null =
    latest && seatOf(latest.player_id)
      ? {
          seat: seatOf(latest.player_id)!,
          outcome: latest.outcome,
          stageKind: latest.stage_kind,
          turnChanged: !(latest.stage_kind === "rosco" && latest.outcome === "correct"),
          at: Number(latest.at_ms),
        }
      : null;
  const mine = res.rows.find((r) => r.player_id === viewer.id);
  let feedback: FeedbackView | null = null;
  const mySeat = mine ? seatOf(mine.player_id) : null;
  if (mine && mySeat && sets && mine.item_index !== null) {
    const item = (sets[mySeat][mine.stage_kind] as { answers: string[] }[])[mine.item_index];
    feedback = {
      outcome: mine.outcome,
      answer: mine.outcome === "passed" ? null : (item?.answers[0] ?? null),
      given: mine.given_answer,
      points: 0,
      stageKind: mine.stage_kind,
      item: mine.item_index,
    };
  }
  return { lastAction, feedback };
}

/* ─────────────────────────────── Operaciones ─────────────────────────────── */

export interface RoomRef {
  code: string;
}

/** Crea una sala privada. No consume el intento 1 vs 1. */
export async function createRoom(player: Player, mode: GameMode, dbArg?: Database): Promise<RoomRef> {
  const db = dbArg ?? (await defaultDatabase());
  return db.transaction(async (tx) => {
    const now = await serverNow(tx);
    const date = todayKey(now);
    if (await duelAttemptUsed(tx, player.id, date)) throw Errors.attemptUsed("duel");
    const challenge = await getChallengeForDate(tx, date);
    // Una identidad solo mantiene una sala abierta a la vez.
    await tx.query(
      `update multiplayer_rooms set status = 'expired', end_reason = 'cancelled', version = version + 1, updated_at = now()
        where creator_id = $1 and status in ('waiting', 'ready')`,
      [player.id],
    );
    const timing = timingFromEnv();
    const rules = duelRulesFor(mode, timing);
    const expiresAt = Math.min(now + timing.roomWaitingTtlMs, nextChallengeStart(now) - 1);
    const code = newRoomCode();
    const stages = createDuelState(rules, now).stages;
    const inserted = await tx.query<{ id: string }>(
      `insert into multiplayer_rooms (code, challenge_id, challenge_date, mode, status, creator_id, rules, stages, expires_at_ms)
       values ($1, $2, $3, $4, 'waiting', $5, $6, $7, $8) returning id`,
      [code, challenge.id, date, mode, player.id, JSON.stringify(rules), stages, expiresAt],
    );
    await tx.query(
      `insert into multiplayer_participants
         (room_id, player_id, seat, display_name, question_set, is_ready, status, time_bank_ms, progress, last_seen_at_ms)
       values ($1, $2, 1, $3, 'duel_a', false, 'joined', $4, $5, $6)`,
      [
        inserted.rows[0]!.id,
        player.id,
        player.displayName,
        rules.roscoBaseMs,
        JSON.stringify(initialProgress(rules)),
        now,
      ],
    );
    return { code };
  });
}

/** Inicia la partida: consume los intentos de ambos jugadores de forma atómica. */
async function startMatch(tx: Queryable, room: RoomRow, parts: ParticipantRow[], now: number): Promise<RoomRow> {
  if (room.challenge_date !== todayKey(now)) throw Errors.roomExpired();
  for (const p of parts) {
    if (await duelAttemptUsed(tx, p.player_id, room.challenge_date)) {
      throw new AppError(409, "duel_attempt_used", `${p.display_name} ya ha jugado su duelo de hoy.`);
    }
  }
  for (const p of parts) {
    await tx.query(
      `insert into daily_attempts (player_id, challenge_date, kind, mode, room_id) values ($1, $2, 'duel', $3, $4)`,
      [p.player_id, room.challenge_date, room.mode, room.id],
    );
  }
  // Las demás salas abiertas de ambos jugadores quedan canceladas.
  await tx.query(
    `update multiplayer_rooms set status = 'expired', end_reason = 'cancelled', version = version + 1, updated_at = now()
      where id <> $1 and status in ('waiting', 'ready')
        and (creator_id = any($2::uuid[]) or id in (
          select room_id from multiplayer_participants where player_id = any($2::uuid[])))`,
    [room.id, parts.map((p) => p.player_id)],
  );
  const state = createDuelState(room.rules, now);
  for (const p of parts) state.players[p.seat] = { ...state.players[p.seat], lastSeenAt: now };
  const res = await tx.query<RoomRow>(
    `update multiplayer_rooms set status = 'in_progress', stage_index = 0, turn_seat = $2, turn_started_at_ms = $3,
        turn_number = $4, started_at_ms = $5, version = version + 1, updated_at = now()
      where id = $1 returning ${ROOM_COLUMNS}`,
    [room.id, state.turnSeat, state.turnStartedAt, state.turnNumber, now],
  );
  for (const p of parts) {
    const pl = state.players[p.seat];
    await tx.query(
      `update multiplayer_participants set status = 'playing', time_bank_ms = $2, progress = $3, last_seen_at_ms = $4
        where id = $1`,
      [p.id, pl.bankMs, JSON.stringify({ rosco: pl.rosco, roscoGiven: pl.roscoGiven, phases: pl.phases }), now],
    );
  }
  return res.rows[0]!;
}

async function withRoomTx<T>(
  db: Database,
  code: string,
  fn: (tx: Queryable, room: RoomRow, parts: ParticipantRow[], now: number) => Promise<T>,
): Promise<T> {
  if (!isValidRoomCode(code)) throw Errors.roomNotFound();
  const result = await db.transaction(async (tx) => {
    const room = await lockRoomByCode(tx, code);
    const parts = await loadParticipants(tx, room.id, true);
    const now = await serverNow(tx);
    const value = await fn(tx, room, parts, now);
    return { value, room: { id: room.id, code: room.code } };
  });
  await publishRoomUpdate(result.room);
  return result.value;
}

/** El invitado acepta el desafío (entra sin registrarse). */
export async function joinRoom(player: Player, code: string, dbArg?: Database): Promise<void> {
  const db = dbArg ?? (await defaultDatabase());
  try {
    await withRoomTx(db, code, async (tx, roomIn, parts, now) => {
      const room = await expireIfStale(tx, roomIn, now);
      if (parts.some((p) => p.player_id === player.id)) {
        if (room.creator_id === player.id && room.status === "waiting") throw Errors.ownRoom();
        return;
      }
      if (room.status === "expired") throw Errors.roomExpired();
      if (room.status !== "waiting" || parts.length >= 2) throw Errors.roomFull();
      if (await duelAttemptUsed(tx, player.id, room.challenge_date)) throw Errors.attemptUsed("duel");
      const host = parts.find((p) => p.seat === 1);
      if (host && (await duelAttemptUsed(tx, host.player_id, room.challenge_date))) {
        await tx.query(
          `update multiplayer_rooms set status = 'expired', end_reason = 'cancelled', version = version + 1 where id = $1`,
          [room.id],
        );
        throw new AppError(410, "room_expired", "El anfitrión ya ha jugado su duelo de hoy: la sala se ha cerrado.");
      }
      await tx.query(
        `insert into multiplayer_participants
           (room_id, player_id, seat, display_name, question_set, is_ready, status, time_bank_ms, progress, last_seen_at_ms)
         values ($1, $2, 2, $3, 'duel_b', true, 'joined', $4, $5, $6)`,
        [
          room.id,
          player.id,
          player.displayName,
          room.rules.roscoBaseMs,
          JSON.stringify(initialProgress(room.rules)),
          now,
        ],
      );
      await tx.query(
        `update multiplayer_rooms set status = 'ready', version = version + 1, updated_at = now() where id = $1`,
        [room.id],
      );
      if (host?.is_ready) {
        const fresh = await lockRoomByCode(tx, code);
        await startMatch(tx, fresh, await loadParticipants(tx, room.id, true), now);
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw Errors.roomFull();
    throw error;
  }
}

/** Marca al jugador como preparado; cuando ambos lo están, empieza el duelo. */
export async function setReady(player: Player, code: string, ready: boolean, dbArg?: Database): Promise<void> {
  const db = dbArg ?? (await defaultDatabase());
  try {
    await withRoomTx(db, code, async (tx, roomIn, parts, now) => {
      const room = await expireIfStale(tx, roomIn, now);
      const me = parts.find((p) => p.player_id === player.id);
      if (!me) throw Errors.notParticipant();
      if (room.status === "in_progress") return;
      if (room.status !== "waiting" && room.status !== "ready") throw Errors.roomExpired();
      await tx.query("update multiplayer_participants set is_ready = $2, last_seen_at_ms = $3 where id = $1", [
        me.id,
        ready,
        now,
      ]);
      await tx.query("update multiplayer_rooms set version = version + 1, updated_at = now() where id = $1", [room.id]);
      const updatedParts = parts.map((p) => (p.id === me.id ? { ...p, is_ready: ready } : p));
      if (room.status === "ready" && updatedParts.length === 2 && updatedParts.every((p) => p.is_ready)) {
        await startMatch(tx, room, updatedParts, now);
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw Errors.attemptUsed("duel");
    throw error;
  }
}

/**
 * Salir de la sala. Antes de empezar no consume nada (el anfitrión la cancela;
 * el invitado deja su asiento libre). Durante la partida equivale a rendirse.
 */
export async function leaveRoom(player: Player, code: string, dbArg?: Database): Promise<void> {
  const db = dbArg ?? (await defaultDatabase());
  await withRoomTx(db, code, async (tx, room, parts, now) => {
    const me = parts.find((p) => p.player_id === player.id);
    if (!me) throw Errors.notParticipant();
    if (room.status === "waiting" || room.status === "ready") {
      if (me.seat === 1) {
        await tx.query(
          `update multiplayer_rooms set status = 'expired', end_reason = 'cancelled', version = version + 1, updated_at = now()
            where id = $1`,
          [room.id],
        );
      } else {
        await tx.query("delete from multiplayer_participants where id = $1", [me.id]);
        await tx.query(
          `update multiplayer_rooms set status = 'waiting', version = version + 1, updated_at = now() where id = $1`,
          [room.id],
        );
      }
      return;
    }
    if (room.status !== "in_progress") return;
    const sets = await loadSets(tx, room.challenge_id);
    const settled = settleDuel(toDuelState(room, parts), now, sets).state;
    if (settled.status !== "in_progress") {
      await persistDuel(tx, room, parts, settled);
      return;
    }
    const state: DuelState = { ...settled, players: { 1: { ...settled.players[1] }, 2: { ...settled.players[2] } } };
    // Rendición: se detiene su reloj si estaba en juego y pierde la partida.
    if (state.turnSeat === me.seat && state.turnStartedAt !== null && stageKindOf(state) === "rosco") {
      const p = state.players[me.seat];
      const elapsed = Math.min(p.bankMs, Math.max(0, now - state.turnStartedAt));
      state.players[me.seat] = { ...p, bankMs: p.bankMs - elapsed, timeUsedMs: p.timeUsedMs + elapsed };
    }
    state.players[me.seat] = { ...state.players[me.seat], status: "abandoned" };
    const rival = me.seat === 1 ? 2 : 1;
    state.status = "abandoned";
    state.endReason = "abandoned";
    state.winnerSeat = state.players[rival].status === "abandoned" ? null : rival;
    state.turnSeat = null;
    state.turnStartedAt = null;
    state.finishedAt = now;
    await persistDuel(tx, room, parts, state);
  });
}

export interface RoomActionInput {
  actionId: string;
  action: DuelAction;
}

/** Acción del jugador en su turno. El servidor valida turno, pregunta activa y tiempo. */
export async function roomAction(
  player: Player,
  code: string,
  input: RoomActionInput,
  dbArg?: Database,
): Promise<{ view: DuelView; feedback: FeedbackView | null; duplicate: boolean }> {
  const db = dbArg ?? (await defaultDatabase());
  const outcome = await withRoomTx(db, code, async (tx, room, parts, now) => {
    const me = parts.find((p) => p.player_id === player.id);
    if (!me) throw Errors.notParticipant();
    const sets = await loadSets(tx, room.challenge_id);
    const dup = await tx.query("select 1 from game_answers where player_id = $1 and action_id = $2", [
      player.id,
      input.actionId,
    ]);
    if (dup.rowCount > 0 || room.status !== "in_progress") {
      const state = room.status === "waiting" || room.status === "ready" ? null : toDuelState(room, parts);
      if (dup.rowCount === 0)
        return { rejected: new AppError(409, "finished", "La partida no está en curso.") } as const;
      const extras = await lastActions(tx, room, parts, player, sets);
      return {
        result: {
          view: buildDuelView({
            room,
            parts,
            state,
            sets,
            viewer: player,
            now,
            ...extras,
            canJoin: false,
            joinBlockedReason: null,
          }),
          feedback: null,
          duplicate: true,
        },
      } as const;
    }

    let state = toDuelState(room, parts);
    state.players[me.seat] = { ...state.players[me.seat], lastSeenAt: now };
    let applied;
    try {
      applied = applyDuelAction(state, me.seat, input.action, sets, now);
    } catch (error) {
      if (!(error instanceof GameRuleError)) throw error;
      const settled = settleDuel(state, now, sets);
      if (settled.state !== state) {
        await persistDuel(tx, room, parts, settled.state);
        await logDuelEvents(
          tx,
          room.id,
          parts,
          settled.events.map((event) => ({ event, actionId: randomUUID() })),
        );
      }
      return { rejected: new AppError(409, error.code, error.message) } as const;
    }
    state = applied.state;
    const updatedRoom = await persistDuel(tx, room, parts, state);
    await logDuelEvents(tx, room.id, parts, [
      ...applied.settleEvents.map((event) => ({ event, actionId: randomUUID() })),
      { event: applied.event, actionId: input.actionId },
    ]);
    const freshParts = await loadParticipants(tx, room.id);
    const extras = await lastActions(tx, updatedRoom, freshParts, player, sets);
    const feedback: FeedbackView | null =
      applied.event.type === "clue"
        ? null
        : {
            outcome: applied.event.outcome as FeedbackView["outcome"],
            answer: applied.event.revealedAnswer,
            given: applied.event.given,
            points: applied.event.points,
            stageKind: applied.event.stageKind,
            item: applied.event.item,
          };
    return {
      result: {
        view: buildDuelView({
          room: updatedRoom,
          parts: freshParts,
          state,
          sets,
          viewer: player,
          now,
          lastAction: extras.lastAction,
          feedback: feedback ?? extras.feedback,
          canJoin: false,
          joinBlockedReason: null,
        }),
        feedback,
        duplicate: false,
      },
    } as const;
  });
  if ("rejected" in outcome) throw outcome.rejected;
  return outcome.result;
}

/** Aplica las transiciones por tiempo (fin de reloj, abandono) si corresponde. */
async function settleRoomIfNeeded(db: Database, room: RoomRow, parts: ParticipantRow[], now: number): Promise<boolean> {
  if (room.status !== "in_progress") return false;
  const sets = await loadSets(db, room.challenge_id);
  const current = toDuelState(room, parts);
  // settleDuel devuelve el mismo objeto si el tiempo no ha cambiado nada.
  if (settleDuel(current, now, sets).state === current) return false;
  await withRoomTx(db, room.code, async (tx, lockedRoom, lockedParts, lockNow) => {
    if (lockedRoom.status !== "in_progress") return;
    const lockedState = toDuelState(lockedRoom, lockedParts);
    const settled = settleDuel(lockedState, lockNow, sets);
    if (settled.state === lockedState) return;
    await persistDuel(tx, lockedRoom, lockedParts, settled.state);
    await logDuelEvents(
      tx,
      lockedRoom.id,
      lockedParts,
      settled.events.map((event) => ({ event, actionId: randomUUID() })),
    );
  });
  return true;
}

/** Registra presencia del jugador (latido) sin bloquear la sala. */
export async function touchPresence(db: Queryable, roomId: string, playerId: string, now: number): Promise<void> {
  await db.query(
    `update multiplayer_participants set last_seen_at_ms = greatest(last_seen_at_ms, $3::bigint)
      where room_id = $1 and player_id = $2 and last_seen_at_ms < $3::bigint - 2000`,
    [roomId, playerId, now],
  );
}

export interface RoomSnapshot {
  roomId: string;
  version: number;
  status: RoomStatus;
  view: DuelView;
}

/** Vista de la sala para el visitante (participante o invitado potencial). */
export async function getRoomView(player: Player, code: string, dbArg?: Database): Promise<RoomSnapshot> {
  const db = dbArg ?? (await defaultDatabase());
  if (!isValidRoomCode(code)) throw Errors.roomNotFound();
  let now = await serverNow(db);
  const load = async () => {
    const res = await db.query<RoomRow>(`select ${ROOM_COLUMNS} from multiplayer_rooms where code = $1`, [code]);
    const room = res.rows[0];
    if (!room) throw Errors.roomNotFound();
    return { room, parts: await loadParticipants(db, room.id) };
  };
  let { room, parts } = await load();
  const me = parts.find((p) => p.player_id === player.id);
  if (!me && parts.length >= 2) throw Errors.roomFull();

  if (me) await touchPresence(db, room.id, player.id, now);
  if (
    (room.status === "waiting" || room.status === "ready") &&
    (now > room.expires_at_ms || room.challenge_date !== todayKey(now))
  ) {
    await db.transaction(async (tx) => {
      const locked = await lockRoomByCode(tx, code);
      await expireIfStale(tx, locked, await serverNow(tx));
    });
    await publishRoomUpdate({ id: room.id, code: room.code });
    ({ room, parts } = await load());
  } else if (room.status === "in_progress") {
    const changed = await settleRoomIfNeeded(db, room, parts, now);
    if (changed) {
      ({ room, parts } = await load());
      now = await serverNow(db);
    }
  }

  const sets = room.status === "waiting" || room.status === "ready" ? null : await loadSets(db, room.challenge_id);
  const state = sets ? toDuelState(room, parts) : null;
  if (state && me) state.players[me.seat] = { ...state.players[me.seat], lastSeenAt: now };

  let canJoin = false;
  let joinBlockedReason: string | null = null;
  if (!me && room.status === "waiting") {
    if (await duelAttemptUsed(db, player.id, room.challenge_date)) {
      joinBlockedReason = "Ya has jugado tu duelo 1 vs 1 de hoy. Podrás aceptar desafíos mañana.";
    } else {
      canJoin = true;
    }
  }
  const extras = me ? await lastActions(db, room, parts, player, sets) : { lastAction: null, feedback: null };
  return {
    roomId: room.id,
    version: room.version,
    status: room.status,
    view: buildDuelView({ room, parts, state, sets, viewer: player, now, ...extras, canJoin, joinBlockedReason }),
  };
}

/** Versión actual y datos mínimos para el bucle SSE (consulta ligera). */
export async function roomPulse(
  db: Queryable,
  roomId: string,
): Promise<{ version: number; status: RoomStatus; expiresAt: number | null } | null> {
  const res = await db.query<{
    version: number;
    status: RoomStatus;
    turn_started_at_ms: number | null;
    stage_kind: StageKind | null;
    active_bank_ms: number | null;
    shot_clock_ms: number | null;
  }>(
    `select r.version, r.status, r.turn_started_at_ms,
            r.stages[r.stage_index + 1] as stage_kind,
            (select p.time_bank_ms from multiplayer_participants p where p.room_id = r.id and p.seat = r.turn_seat) as active_bank_ms,
            (r.rules -> 'shotClockMs' ->> r.stages[r.stage_index + 1])::int as shot_clock_ms
       from multiplayer_rooms r where r.id = $1`,
    [roomId],
  );
  const r = res.rows[0];
  if (!r) return null;
  let expiresAt: number | null = null;
  if (r.status === "in_progress" && r.turn_started_at_ms !== null) {
    const limit = r.stage_kind === "rosco" ? r.active_bank_ms : r.shot_clock_ms;
    if (limit !== null) expiresAt = Number(r.turn_started_at_ms) + Number(limit);
  }
  return { version: r.version, status: r.status, expiresAt };
}

/** Sala abierta (sin empezar) creada hoy por el jugador, si existe. */
export async function openRoomFor(db: Queryable, playerId: string, date: string): Promise<string | null> {
  const res = await db.query<{ code: string }>(
    `select r.code from multiplayer_rooms r
       join multiplayer_participants p on p.room_id = r.id
      where p.player_id = $1 and r.challenge_date = $2 and r.status in ('waiting', 'ready', 'in_progress')
      order by r.created_at desc limit 1`,
    [playerId, date],
  );
  return res.rows[0]?.code ?? null;
}

/** Caduca salas antiguas y cierra duelos cuyo tiempo ha vencido (barrido periódico). */
export async function sweepRooms(dbArg?: Database): Promise<number> {
  const db = dbArg ?? (await defaultDatabase());
  const now = await serverNow(db);
  const expired = await db.query(
    `update multiplayer_rooms set status = 'expired', end_reason = 'expired', version = version + 1, updated_at = now()
      where status in ('waiting', 'ready') and (expires_at_ms < $1 or challenge_date < $2::date)`,
    [now, todayKey(now)],
  );
  const stale = await db.query<RoomRow>(
    `select ${ROOM_COLUMNS} from multiplayer_rooms
      where status = 'in_progress' and turn_started_at_ms is not null and turn_started_at_ms < $1 limit 50`,
    [now - 30_000],
  );
  let settled = 0;
  for (const room of stale.rows) {
    const parts = await loadParticipants(db, room.id);
    if (await settleRoomIfNeeded(db, room, parts, now)) settled += 1;
  }
  return expired.rowCount + settled;
}
