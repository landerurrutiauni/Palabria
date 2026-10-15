/**
 * Partidas individuales (Solo El Rosco y Programa completo).
 * El servidor es la única autoridad: consume el intento diario de forma
 * atómica, valida cada respuesta, controla el reloj y calcula el resultado.
 */
import { timingFromEnv } from "@/lib/game/config";
import type { QuestionSet } from "@/lib/game/content-types";
import { GameRuleError } from "@/lib/game/errors";
import type { GameMode } from "@/lib/game/phases";
import { PHASE_RULES, stageTagline, stageTitle } from "@/lib/game/phases";
import { currentItemIndex, sumPhase } from "@/lib/game/phase-items";
import { roscoCounts } from "@/lib/game/rosco";
import { accuracy } from "@/lib/game/scoring";
import {
  applySoloAction,
  createSoloState,
  settleSolo,
  soloRulesFor,
  soloSummary,
  type GameEvent,
  type SoloAction,
  type SoloState,
} from "@/lib/game/solo-engine";
import type { FeedbackView, PhaseReview, SoloResultView, SoloView } from "@/lib/views";
import { getChallengeForDate, loadQuestionSet, todayKey } from "./challenges";
import { serverNow } from "./clock";
import { defaultDatabase, isUniqueViolation, type Database, type Queryable } from "./db-core";
import { serverEnv } from "./env";
import { AppError, Errors } from "./errors";
import type { Player } from "./players";
import { effectiveStreak, recordSoloResult } from "./results";
import {
  fullLetters,
  lettersView,
  phaseItemsView,
  phasePrompt,
  phaseReview,
  revealedClosedLetters,
  roscoPrompt,
  soloShareText,
} from "./view-helpers";

interface SessionRow {
  id: string;
  player_id: string;
  challenge_id: string;
  challenge_date: string;
  mode: GameMode;
  status: SoloState["status"];
  state: SoloState;
  version: number;
}

const SESSION_COLUMNS = "id, player_id, challenge_id, challenge_date, mode, status, state, version";

async function streakFor(db: Queryable, playerId: string, today: string): Promise<{ current: number; best: number }> {
  const res = await db.query<{ current_streak: number; best_streak: number; last_streak_date: string | null }>(
    "select current_streak, best_streak, last_streak_date from player_statistics where player_id = $1",
    [playerId],
  );
  const row = res.rows[0];
  if (!row) return { current: 0, best: 0 };
  return { current: effectiveStreak(row.current_streak, row.last_streak_date, today), best: row.best_streak };
}

function buildResult(
  row: SessionRow,
  state: SoloState,
  set: QuestionSet,
  now: number,
  streak: { current: number; best: number },
): SoloResultView {
  const summary = soloSummary(state, now);
  const rosco = state.stages.find((s) => s.kind === "rosco")!;
  const phases: PhaseReview[] = state.stages
    .filter((s) => s.kind !== "rosco")
    .map((s) => phaseReview(s.kind as Exclude<typeof s.kind, "rosco">, set, s.items));
  const timeMs = row.mode === "rosco" ? summary.roscoTimeUsedMs : summary.totalTimeUsedMs;
  return {
    status: state.status,
    mode: row.mode,
    date: row.challenge_date,
    score: summary.score,
    correct: summary.rosco.correct,
    wrong: summary.rosco.wrong,
    unanswered: summary.rosco.open,
    accuracy: accuracy(summary.rosco.correct, summary.rosco.wrong),
    roscoTimeUsedMs: summary.roscoTimeUsedMs,
    totalTimeUsedMs: summary.totalTimeUsedMs,
    phasePoints: summary.phasePoints,
    roscoPoints: summary.roscoPoints,
    bonusSeconds: Math.round(summary.bonusMs / 1000),
    perfect: summary.perfect,
    roscoComplete: summary.roscoComplete,
    letters: fullLetters(set, rosco.rosco!, rosco.roscoGiven ?? []),
    phases,
    streak,
    shareText: soloShareText({
      date: row.challenge_date,
      mode: row.mode,
      correct: summary.rosco.correct,
      wrong: summary.rosco.wrong,
      unanswered: summary.rosco.open,
      timeMs,
      score: summary.score,
      rosco: rosco.rosco!,
      url: serverEnv().publicUrl,
    }),
  };
}

export function buildSoloView(
  row: SessionRow,
  state: SoloState,
  set: QuestionSet,
  now: number,
  streak: { current: number; best: number },
): SoloView {
  const stage = state.stages[state.stageIndex]!;
  const finished = state.status !== "in_progress";
  const remainingMs =
    stage.status === "playing" && stage.startedAt !== null
      ? Math.max(0, stage.timeLimitMs - Math.max(0, now - stage.startedAt))
      : stage.status === "done"
        ? 0
        : stage.timeLimitMs;

  let prompt: SoloView["stage"]["prompt"] = null;
  if (!finished && stage.status === "playing") {
    if (stage.kind === "rosco" && stage.rosco?.cursor != null) {
      prompt = roscoPrompt(set.rosco[stage.rosco.cursor]!, stage.rosco.cursor);
    } else if (stage.kind !== "rosco") {
      const idx = currentItemIndex(stage.items);
      if (idx !== null) prompt = phasePrompt(stage.kind, set[stage.kind][idx]!, idx, stage.items[idx]!);
    }
  }

  const roscoStage = state.stages.find((s) => s.kind === "rosco")!;
  const counts = roscoCounts(roscoStage.rosco!);
  let phasePoints = 0;
  let bonusMs = 0;
  for (const s of state.stages) {
    if (s.kind === "rosco") continue;
    const sum = sumPhase(s.items);
    phasePoints += sum.points;
    bonusMs += sum.bonusMs;
  }

  const upcomingRoscoMs =
    state.mode === "program" && roscoStage.status !== "playing" && roscoStage.status !== "done"
      ? state.rules.roscoMs + bonusMs
      : null;

  return {
    sessionId: row.id,
    mode: row.mode,
    status: state.status,
    date: row.challenge_date,
    serverNow: now,
    version: row.version,
    stageIndex: state.stageIndex,
    stages: state.stages.map((s) => ({
      kind: s.kind,
      title: stageTitle(s.kind),
      status: s.status,
      points: s.kind === "rosco" ? 0 : sumPhase(s.items).points,
      endReason: s.endReason,
    })),
    stage: {
      kind: stage.kind,
      title: stageTitle(stage.kind),
      tagline: stageTagline(stage.kind),
      howTo:
        stage.kind === "rosco"
          ? "Responde a la definición de cada letra. Si no la sabes, di «Pasapalabra» y volverás a ella en la siguiente vuelta."
          : PHASE_RULES[stage.kind].howTo,
      status: stage.status,
      startedAt: stage.startedAt,
      timeLimitMs: stage.kind === "rosco" && upcomingRoscoMs !== null ? upcomingRoscoMs : stage.timeLimitMs,
      remainingMs: stage.kind === "rosco" && upcomingRoscoMs !== null ? upcomingRoscoMs : remainingMs,
      itemCount: stage.kind === "rosco" ? 27 : stage.items.length,
      prompt,
      items: stage.kind === "rosco" ? [] : phaseItemsView(stage.kind, set, stage.items),
      letters: lettersView(set, roscoStage.rosco!, finished),
      revealed: revealedClosedLetters(set, roscoStage.rosco!),
    },
    upcomingRoscoMs,
    readyDeadline:
      stage.status === "ready" && state.readySince !== null
        ? state.readySince + state.rules.intermissionTimeoutMs
        : null,
    totals: {
      phasePoints,
      bonusSeconds: Math.round(bonusMs / 1000),
      correct: counts.correct,
      wrong: counts.wrong,
      passed: counts.passed,
      open: counts.open,
    },
    result: finished ? buildResult(row, state, set, now, streak) : null,
  };
}

async function persistState(
  tx: Queryable,
  row: SessionRow,
  state: SoloState,
  set: QuestionSet,
  player: Pick<Player, "id" | "displayName">,
  now: number,
): Promise<SessionRow> {
  const res = await tx.query<SessionRow>(
    `update game_sessions
        set state = $2, status = $3, version = version + 1, finished_at_ms = $4, updated_at = now()
      where id = $1
      returning ${SESSION_COLUMNS}`,
    [row.id, JSON.stringify(state), state.status, state.finishedAt],
  );
  if (state.status !== "in_progress") {
    await recordSoloResult(tx, {
      playerId: player.id,
      displayName: player.displayName,
      sessionId: row.id,
      date: row.challenge_date,
      mode: row.mode,
      state,
      set,
      now,
    });
  }
  return res.rows[0]!;
}

async function logEvent(
  tx: Queryable,
  playerId: string,
  sessionId: string,
  actionId: string,
  event: GameEvent,
): Promise<void> {
  await tx.query(
    `insert into game_answers
       (player_id, session_id, action_id, stage_index, stage_kind, item_index, action, outcome, given_answer, clock_ms)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (player_id, action_id) do nothing`,
    [
      playerId,
      sessionId,
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

/** Empieza la partida individual del día. Consume el intento de forma atómica. */
export async function startSolo(player: Player, mode: GameMode, dbArg?: Database): Promise<SoloView> {
  const db = dbArg ?? (await defaultDatabase());
  try {
    return await db.transaction(async (tx) => {
      const now = await serverNow(tx);
      const date = todayKey(now);
      const challenge = await getChallengeForDate(tx, date);
      const existing = await tx.query<SessionRow>(
        `select ${SESSION_COLUMNS} from game_sessions where player_id = $1 and challenge_date = $2 for update`,
        [player.id, date],
      );
      const current = existing.rows[0];
      if (current) {
        // Doble clic o segunda pestaña: se devuelve la misma partida, nunca otra.
        if (current.mode === mode && current.status === "in_progress") {
          const set = await loadQuestionSet(tx, current.challenge_id, "solo");
          return buildSoloView(current, current.state, set, now, await streakFor(tx, player.id, date));
        }
        throw Errors.attemptUsed("solo");
      }
      const state = createSoloState(soloRulesFor(mode, timingFromEnv()), now);
      const inserted = await tx.query<SessionRow>(
        `insert into game_sessions (player_id, challenge_id, challenge_date, mode, status, state, started_at_ms)
         values ($1, $2, $3, $4, 'in_progress', $5, $6)
         returning ${SESSION_COLUMNS}`,
        [player.id, challenge.id, date, mode, JSON.stringify(state), now],
      );
      const row = inserted.rows[0]!;
      await tx.query(
        `insert into daily_attempts (player_id, challenge_date, kind, mode, session_id) values ($1, $2, 'solo', $3, $4)`,
        [player.id, date, mode, row.id],
      );
      const set = await loadQuestionSet(tx, challenge.id, "solo");
      return buildSoloView(row, state, set, now, await streakFor(tx, player.id, date));
    });
  } catch (error) {
    // Dos peticiones simultáneas: la restricción única impide la segunda partida.
    if (isUniqueViolation(error)) {
      const view = await getTodaySolo(player, db);
      if (view && view.mode === mode && view.status === "in_progress") return view;
      throw Errors.attemptUsed("solo");
    }
    throw error;
  }
}

async function loadAndSettle(
  db: Database,
  player: Player,
  where: { sessionId?: string; date?: string },
): Promise<SoloView | null> {
  const now = await serverNow(db);
  const filter = where.sessionId ? "id = $2" : "challenge_date = $2";
  const value = where.sessionId ?? where.date;
  const res = await db.query<SessionRow>(
    `select ${SESSION_COLUMNS} from game_sessions where player_id = $1 and ${filter}`,
    [player.id, value],
  );
  let row = res.rows[0];
  if (!row) return null;
  const set = await loadQuestionSet(db, row.challenge_id, "solo");
  let state = row.state;
  if (state.status === "in_progress") {
    const settled = settleSolo(state, now);
    if (settled.state !== state) {
      // El reloj ha cambiado el estado (fin de tiempo): se persiste con bloqueo.
      const result = await db.transaction(async (tx) => {
        const locked = (
          await tx.query<SessionRow>(`select ${SESSION_COLUMNS} from game_sessions where id = $1 for update`, [row!.id])
        ).rows[0]!;
        const lockNow = await serverNow(tx);
        const again = settleSolo(locked.state, lockNow);
        if (again.state === locked.state) return { row: locked, state: locked.state };
        const updated = await persistState(tx, locked, again.state, set, player, lockNow);
        return { row: updated, state: again.state };
      });
      row = result.row;
      state = result.state;
    }
  }
  return buildSoloView(row, state, set, now, await streakFor(db, player.id, todayKey(now)));
}

/** Partida individual de hoy (o null si no se ha empezado). */
export async function getTodaySolo(player: Player, dbArg?: Database): Promise<SoloView | null> {
  const db = dbArg ?? (await defaultDatabase());
  const now = await serverNow(db);
  return loadAndSettle(db, player, { date: todayKey(now) });
}

export async function getSoloSession(player: Player, sessionId: string, dbArg?: Database): Promise<SoloView | null> {
  const db = dbArg ?? (await defaultDatabase());
  return loadAndSettle(db, player, { sessionId });
}

export interface SoloActionInput {
  sessionId: string;
  actionId: string;
  action: SoloAction;
}

function feedbackFrom(event: GameEvent): FeedbackView | null {
  if (event.type === "start_stage") return null;
  return {
    outcome: event.outcome as FeedbackView["outcome"],
    answer: event.revealedAnswer,
    given: event.given,
    points: event.points,
    stageKind: event.stageKind,
    item: event.item,
  };
}

/** Aplica una acción del jugador con bloqueo de fila e idempotencia por `actionId`. */
export async function soloAction(
  player: Player,
  input: SoloActionInput,
  dbArg?: Database,
): Promise<{ view: SoloView; feedback: FeedbackView | null; duplicate: boolean }> {
  const db = dbArg ?? (await defaultDatabase());
  const outcome = await db.transaction(async (tx) => {
    const res = await tx.query<SessionRow>(
      `select ${SESSION_COLUMNS} from game_sessions where id = $1 and player_id = $2 for update`,
      [input.sessionId, player.id],
    );
    const row = res.rows[0];
    if (!row) throw new AppError(404, "session_not_found", "No se encuentra la partida.");
    const now = await serverNow(tx);
    const set = await loadQuestionSet(tx, row.challenge_id, "solo");
    const streakToday = () => streakFor(tx, player.id, todayKey(now));

    const dup = await tx.query<{ outcome: string }>(
      "select outcome from game_answers where player_id = $1 and action_id = $2",
      [player.id, input.actionId],
    );
    if (dup.rowCount > 0) {
      // Reenvío de una acción ya aplicada: no se vuelve a puntuar.
      return {
        result: { view: buildSoloView(row, row.state, set, now, await streakToday()), feedback: null, duplicate: true },
      } as const;
    }

    let applied;
    try {
      applied = applySoloAction(row.state, input.action, set, now);
    } catch (error) {
      if (error instanceof GameRuleError) {
        // Se guarda el efecto del reloj (si lo hay) y se informa del rechazo tras confirmar.
        const settled = settleSolo(row.state, now);
        if (settled.state !== row.state) await persistState(tx, row, settled.state, set, player, now);
        return { rejected: new AppError(409, error.code, error.message) } as const;
      }
      throw error;
    }
    const updated = await persistState(tx, row, applied.state, set, player, now);
    await logEvent(tx, player.id, row.id, input.actionId, applied.event);
    return {
      result: {
        view: buildSoloView(updated, applied.state, set, now, await streakToday()),
        feedback: feedbackFrom(applied.event),
        duplicate: false,
      },
    } as const;
  });
  if ("rejected" in outcome) throw outcome.rejected;
  return outcome.result;
}

/**
 * Cierra las partidas individuales cuyo reloj ya ha vencido aunque el
 * jugador no haya vuelto (para que su resultado y la clasificación existan).
 */
export async function sweepSoloSessions(dbArg?: Database): Promise<number> {
  const db = dbArg ?? (await defaultDatabase());
  const now = await serverNow(db);
  const res = await db.query<{ id: string }>(
    `select id from game_sessions where status = 'in_progress' and started_at_ms < $1 order by started_at_ms limit 100`,
    [now - 60_000],
  );
  let closed = 0;
  for (const { id } of res.rows) {
    const done = await db.transaction(async (tx) => {
      const row = (
        await tx.query<SessionRow & { display_name: string }>(
          `select s.id, s.player_id, s.challenge_id, s.challenge_date, s.mode, s.status, s.state, s.version, p.display_name
             from game_sessions s join anonymous_players p on p.id = s.player_id
            where s.id = $1 and s.status = 'in_progress' for update of s`,
          [id],
        )
      ).rows[0];
      if (!row) return false;
      const lockNow = await serverNow(tx);
      const settled = settleSolo(row.state, lockNow);
      if (settled.state === row.state) return false;
      const set = await loadQuestionSet(tx, row.challenge_id, "solo");
      await persistState(tx, row, settled.state, set, { id: row.player_id, displayName: row.display_name }, lockNow);
      return settled.state.status !== "in_progress";
    });
    if (done) closed += 1;
  }
  return closed;
}
