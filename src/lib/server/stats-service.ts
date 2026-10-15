/**
 * Estado del jugador (intentos del día) y sus preferencias.
 */
import { nextChallengeStart } from "@/lib/game/daily";
import type { GameMode } from "@/lib/game/phases";
import type { AttemptStatus, MeView, PreferencesView, RoomStatus } from "@/lib/views";
import { todayKey } from "./challenges";
import { serverNow } from "./clock";
import type { Queryable } from "./db-core";
import type { Player } from "./players";
import { effectiveStreak } from "./results";
import { openRoomFor } from "./room-service";

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
  }>(
    "select sound_enabled, sound_volume, motion, high_contrast, large_text from player_preferences where player_id = $1",
    [playerId],
  );
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

export async function savePreferences(
  db: Queryable,
  playerId: string,
  prefs: PreferencesView,
): Promise<PreferencesView> {
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
