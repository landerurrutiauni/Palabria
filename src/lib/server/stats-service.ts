/**
 * Estadísticas, historial, clasificación y estado del jugador.
 * Todo se calcula a partir de resultados persistidos y verificados.
 */
import { nextChallengeStart } from "@/lib/game/daily";
import type { GameMode } from "@/lib/game/phases";
import { accuracy } from "@/lib/game/scoring";
import type {
  AttemptStatus,
  HistoryEntry,
  LeaderboardEntry,
  LeaderboardView,
  MeView,
  PreferencesView,
  RoomStatus,
  StatsView,
} from "@/lib/views";
import { todayKey } from "./challenges";
import { serverNow } from "./clock";
import type { Queryable } from "./db";
import type { Player } from "./identity";
import { effectiveStreak } from "./results";
import { openRoomFor } from "./room-service";

export const LEADERBOARD_MIN_ENTRIES = 3;

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

const DEFAULT_PREFS: PreferencesView = {
  soundEnabled: true,
  soundVolume: 70,
  motion: "system",
  highContrast: false,
  largeText: false,
};

export async function getPreferences(db: Queryable, playerId: string): Promise<PreferencesView> {
  const res = await db.query<{
    sound_enabled: boolean;
    sound_volume: number;
    motion: PreferencesView["motion"];
    high_contrast: boolean;
    large_text: boolean;
  }>("select sound_enabled, sound_volume, motion, high_contrast, large_text from player_preferences where player_id = $1", [
    playerId,
  ]);
  const r = res.rows[0];
  if (!r) return DEFAULT_PREFS;
  return {
    soundEnabled: r.sound_enabled,
    soundVolume: r.sound_volume,
    motion: r.motion,
    highContrast: r.high_contrast,
    largeText: r.large_text,
  };
}

export async function savePreferences(db: Queryable, playerId: string, prefs: PreferencesView): Promise<PreferencesView> {
  await db.query(
    `insert into player_preferences (player_id, sound_enabled, sound_volume, motion, high_contrast, large_text, updated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (player_id) do update set
       sound_enabled = excluded.sound_enabled, sound_volume = excluded.sound_volume, motion = excluded.motion,
       high_contrast = excluded.high_contrast, large_text = excluded.large_text, updated_at = now()`,
    [playerId, prefs.soundEnabled, prefs.soundVolume, prefs.motion, prefs.highContrast, prefs.largeText],
  );
  return prefs;
}

export async function attemptStatus(db: Queryable, playerId: string, date: string): Promise<AttemptStatus> {
  const solo = await db.query<{ id: string; mode: GameMode; status: AttemptStatus["solo"]["status"] }>(
    "select id, mode, status from game_sessions where player_id = $1 and challenge_date = $2",
    [playerId, date],
  );
  const duel = await db.query<{ code: string | null; status: RoomStatus | null }>(
    `select r.code, r.status from daily_attempts a left join multiplayer_rooms r on r.id = a.room_id
      where a.player_id = $1 and a.challenge_date = $2 and a.kind = 'duel'`,
    [playerId, date],
  );
  const s = solo.rows[0];
  const d = duel.rows[0];
  return {
    solo: { used: !!s, mode: s?.mode ?? null, sessionId: s?.id ?? null, status: s?.status ?? null },
    duel: {
      used: !!d,
      roomCode: d?.code ?? null,
      status: d?.status ?? null,
      openRoomCode: d ? null : await openRoomFor(db, playerId, date),
    },
  };
}

async function statsRow(db: Queryable, playerId: string): Promise<StatsRow | null> {
  const res = await db.query<StatsRow>("select * from player_statistics where player_id = $1", [playerId]);
  return res.rows[0] ?? null;
}

export async function getMe(db: Queryable, player: Player): Promise<MeView> {
  const now = await serverNow(db);
  const today = todayKey(now);
  const row = await statsRow(db, player.id);
  return {
    id: player.id,
    displayName: player.displayName,
    nameIsCustom: player.nameIsCustom,
    today,
    nextResetAt: nextChallengeStart(now),
    serverNow: now,
    attempts: await attemptStatus(db, player.id, today),
    streak: {
      current: row ? effectiveStreak(row.current_streak, row.last_streak_date, today) : 0,
      best: row?.best_streak ?? 0,
    },
    preferences: await getPreferences(db, player.id),
  };
}

export async function getStats(db: Queryable, player: Player): Promise<StatsView> {
  const now = await serverNow(db);
  const today = todayKey(now);
  const r = await statsRow(db, player.id);
  const history = await db.query<{
    id: string;
    challenge_date: string;
    kind: "solo" | "duel";
    mode: GameMode;
    status: "completed" | "abandoned";
    correct: number;
    wrong: number;
    unanswered: number;
    score: number;
    time_used_ms: number;
    outcome: HistoryEntry["outcome"];
    opponent_name: string | null;
    perfect: boolean;
    room_code: string | null;
  }>(
    `select g.id, g.challenge_date, g.kind, g.mode, g.status, g.correct, g.wrong, g.unanswered, g.score, g.time_used_ms,
            g.outcome, g.opponent_name, g.perfect, r.code as room_code
       from game_results g left join multiplayer_rooms r on r.id = g.room_id
      where g.player_id = $1
      order by g.challenge_date desc, g.created_at desc
      limit 120`,
    [player.id],
  );
  return {
    solo: {
      played: r?.solo_played ?? 0,
      completed: r?.solo_completed ?? 0,
      correct: r?.solo_correct ?? 0,
      wrong: r?.solo_wrong ?? 0,
      accuracy: accuracy(r?.solo_correct ?? 0, r?.solo_wrong ?? 0),
      bestScoreRosco: r?.best_score_rosco ?? null,
      bestScoreProgram: r?.best_score_program ?? null,
      bestTimeMs: r?.best_time_ms ?? null,
      roscosCompleted: r?.roscos_completed ?? 0,
      perfectRoscos: r?.perfect_roscos ?? 0,
    },
    duel: {
      played: r?.duel_played ?? 0,
      wins: r?.duel_wins ?? 0,
      losses: r?.duel_losses ?? 0,
      draws: r?.duel_draws ?? 0,
      correct: r?.duel_correct ?? 0,
      wrong: r?.duel_wrong ?? 0,
      accuracy: accuracy(r?.duel_correct ?? 0, r?.duel_wrong ?? 0),
    },
    streak: {
      current: r ? effectiveStreak(r.current_streak, r.last_streak_date, today) : 0,
      best: r?.best_streak ?? 0,
      lastDate: r?.last_streak_date ?? null,
    },
    history: history.rows.map((h) => ({
      id: h.id,
      date: h.challenge_date,
      kind: h.kind,
      mode: h.mode,
      status: h.status,
      correct: h.correct,
      wrong: h.wrong,
      unanswered: h.unanswered,
      score: h.score,
      timeUsedMs: h.time_used_ms,
      outcome: h.outcome,
      opponentName: h.opponent_name,
      perfect: h.perfect,
      link: h.kind === "duel" ? (h.room_code ? `/sala/${h.room_code}` : null) : `/historial/${h.id}`,
    })),
  };
}

export async function getLeaderboard(
  db: Queryable,
  args: { date: string; mode: GameMode; playerId: string | null; limit?: number },
): Promise<LeaderboardView> {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
  const res = await db.query<{
    player_id: string;
    display_name: string;
    score: number;
    correct: number;
    wrong: number;
    time_used_ms: number;
    perfect: boolean;
    rank: number;
    total: number;
  }>(
    `select player_id, display_name, score, correct, wrong, time_used_ms, perfect,
            rank() over (order by score desc, correct desc, wrong asc, time_used_ms asc)::int as rank,
            count(*) over ()::int as total
       from game_results
      where challenge_date = $1 and kind = 'solo' and mode = $2 and status = 'completed'
      order by rank, finished_at_ms
      limit 500`,
    [args.date, args.mode],
  );
  const toEntry = (r: (typeof res.rows)[number]): LeaderboardEntry => ({
    rank: r.rank,
    name: r.display_name,
    score: r.score,
    correct: r.correct,
    wrong: r.wrong,
    timeUsedMs: r.time_used_ms,
    perfect: r.perfect,
    isYou: r.player_id === args.playerId,
  });
  const total = res.rows[0]?.total ?? 0;
  const mine = res.rows.find((r) => r.player_id === args.playerId);
  return {
    date: args.date,
    mode: args.mode,
    total,
    minEntries: LEADERBOARD_MIN_ENTRIES,
    entries: total >= LEADERBOARD_MIN_ENTRIES ? res.rows.slice(0, limit).map(toEntry) : [],
    you: mine ? toEntry(mine) : null,
  };
}
