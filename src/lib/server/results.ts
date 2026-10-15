/**
 * Registro de resultados y estadísticas. Se ejecuta dentro de la transacción
 * que termina la partida; la restricción única de `game_results` garantiza
 * que una partida nunca se cuente dos veces aunque se repita la operación.
 */
import { addDays } from "@/lib/game/daily";
import type { QuestionSet } from "@/lib/game/content-types";
import type { DuelState, Seat } from "@/lib/game/duel-engine";
import { duelLine, duelOutcomeFor } from "@/lib/game/duel-engine";
import type { GameMode } from "@/lib/game/phases";
import { roscoCounts } from "@/lib/game/rosco";
import { soloSummary, type SoloState } from "@/lib/game/solo-engine";
import type { Queryable } from "./db";

interface StatsRow {
  solo_played: number;
  solo_completed: number;
  solo_correct: number;
  solo_wrong: number;
  best_score_rosco: number | null;
  best_score_program: number | null;
  best_time_ms: number | null;
  roscos_completed: number;
  perfect_roscos: number;
  current_streak: number;
  best_streak: number;
  last_streak_date: string | null;
  duel_played: number;
  duel_wins: number;
  duel_losses: number;
  duel_draws: number;
  duel_correct: number;
  duel_wrong: number;
}

async function lockStats(tx: Queryable, playerId: string): Promise<StatsRow> {
  await tx.query("insert into player_statistics (player_id) values ($1) on conflict (player_id) do nothing", [playerId]);
  const res = await tx.query<StatsRow>("select * from player_statistics where player_id = $1 for update", [playerId]);
  return res.rows[0]!;
}

/** Regla de racha: se suma un día al completar el desafío individual; se rompe si se salta un día. */
export function nextStreak(
  current: number,
  best: number,
  lastDate: string | null,
  date: string,
): { current: number; best: number; lastDate: string } {
  if (lastDate === date) return { current, best, lastDate };
  if (lastDate && lastDate > date) return { current, best, lastDate };
  const value = lastDate === addDays(date, -1) ? current + 1 : 1;
  return { current: value, best: Math.max(best, value), lastDate: date };
}

/** Racha vigente a fecha de hoy (si ayer no se completó, la racha está rota). */
export function effectiveStreak(current: number, lastDate: string | null, today: string): number {
  if (!lastDate) return 0;
  return lastDate === today || lastDate === addDays(today, -1) ? current : 0;
}

export async function recordSoloResult(
  tx: Queryable,
  args: {
    playerId: string;
    displayName: string;
    sessionId: string;
    date: string;
    mode: GameMode;
    state: SoloState;
    set: QuestionSet;
    now: number;
  },
): Promise<boolean> {
  const { state } = args;
  const summary = soloSummary(state, args.now);
  const roscoStage = state.stages.find((s) => s.kind === "rosco");
  const details = {
    rosco: roscoStage?.rosco?.statuses ?? [],
    stages: state.stages.map((s) => ({ kind: s.kind, endReason: s.endReason })),
    bonusMs: summary.bonusMs,
    phasePoints: summary.phasePoints,
    roscoPoints: summary.roscoPoints,
  };
  const status = state.status === "abandoned" ? "abandoned" : "completed";
  const inserted = await tx.query<{ id: string }>(
    `insert into game_results
       (player_id, challenge_date, kind, mode, status, session_id, display_name, correct, wrong, unanswered,
        phase_points, score, time_used_ms, rosco_complete, perfect, details, finished_at_ms)
     values ($1, $2, 'solo', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     on conflict do nothing
     returning id`,
    [
      args.playerId,
      args.date,
      args.mode,
      status,
      args.sessionId,
      args.displayName,
      summary.rosco.correct,
      summary.rosco.wrong,
      summary.rosco.open,
      summary.phasePoints,
      summary.score,
      Math.round(summary.mode === "rosco" ? summary.roscoTimeUsedMs : summary.totalTimeUsedMs),
      summary.roscoComplete,
      summary.perfect,
      JSON.stringify(details),
      state.finishedAt ?? args.now,
    ],
  );
  if (inserted.rowCount === 0) return false;

  const stats = await lockStats(tx, args.playerId);
  const streak =
    status === "completed"
      ? nextStreak(stats.current_streak, stats.best_streak, stats.last_streak_date, args.date)
      : { current: stats.current_streak, best: stats.best_streak, lastDate: stats.last_streak_date };
  const bestScoreRosco =
    args.mode === "rosco" ? Math.max(stats.best_score_rosco ?? 0, summary.score) : stats.best_score_rosco;
  const bestScoreProgram =
    args.mode === "program" ? Math.max(stats.best_score_program ?? 0, summary.score) : stats.best_score_program;
  const bestTime =
    summary.roscoComplete && summary.roscoTimeUsedMs > 0
      ? Math.min(stats.best_time_ms ?? Number.MAX_SAFE_INTEGER, Math.round(summary.roscoTimeUsedMs))
      : stats.best_time_ms;
  await tx.query(
    `update player_statistics set
       solo_played = solo_played + 1,
       solo_completed = solo_completed + $2,
       solo_correct = solo_correct + $3,
       solo_wrong = solo_wrong + $4,
       best_score_rosco = $5,
       best_score_program = $6,
       best_time_ms = $7,
       roscos_completed = roscos_completed + $8,
       perfect_roscos = perfect_roscos + $9,
       current_streak = $10,
       best_streak = $11,
       last_streak_date = $12,
       updated_at = now()
     where player_id = $1`,
    [
      args.playerId,
      status === "completed" ? 1 : 0,
      summary.rosco.correct,
      summary.rosco.wrong,
      bestScoreRosco,
      bestScoreProgram,
      bestTime,
      summary.roscoComplete ? 1 : 0,
      summary.perfect ? 1 : 0,
      streak.current,
      streak.best,
      streak.lastDate,
    ],
  );
  return true;
}

export interface DuelParticipantInfo {
  seat: Seat;
  playerId: string;
  displayName: string;
}

export async function recordDuelResults(
  tx: Queryable,
  args: {
    roomId: string;
    date: string;
    mode: GameMode;
    state: DuelState;
    participants: DuelParticipantInfo[];
    now: number;
  },
): Promise<void> {
  const { state } = args;
  for (const p of args.participants) {
    const rival = args.participants.find((x) => x.seat !== p.seat);
    const line = duelLine(state, p.seat);
    const outcome = duelOutcomeFor(state, p.seat) ?? "draw";
    const counts = roscoCounts(state.players[p.seat].rosco);
    const details = {
      rosco: state.players[p.seat].rosco.statuses,
      rival: rival ? { seat: rival.seat, ...duelLine(state, rival.seat) } : null,
      endReason: state.endReason,
      abandoned: state.players[p.seat].status === "abandoned",
    };
    const inserted = await tx.query(
      `insert into game_results
         (player_id, challenge_date, kind, mode, status, room_id, display_name, correct, wrong, unanswered,
          phase_points, score, time_used_ms, rosco_complete, perfect, outcome, opponent_name, details, finished_at_ms)
       values ($1, $2, 'duel', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       on conflict do nothing
       returning id`,
      [
        p.playerId,
        args.date,
        args.mode,
        state.status === "abandoned" ? "abandoned" : "completed",
        args.roomId,
        p.displayName,
        line.correct,
        line.wrong,
        line.open,
        line.phasePoints,
        line.correct * 10,
        Math.round(line.timeUsedMs),
        counts.open === 0,
        counts.correct === 27,
        outcome,
        rival?.displayName ?? null,
        JSON.stringify(details),
        state.finishedAt ?? args.now,
      ],
    );
    if (inserted.rowCount === 0) continue;
    await lockStats(tx, p.playerId);
    await tx.query(
      `update player_statistics set
         duel_played = duel_played + 1,
         duel_wins = duel_wins + $2,
         duel_losses = duel_losses + $3,
         duel_draws = duel_draws + $4,
         duel_correct = duel_correct + $5,
         duel_wrong = duel_wrong + $6,
         updated_at = now()
       where player_id = $1`,
      [
        p.playerId,
        outcome === "win" ? 1 : 0,
        outcome === "loss" ? 1 : 0,
        outcome === "draw" ? 1 : 0,
        line.correct,
        line.wrong,
      ],
    );
  }
}
