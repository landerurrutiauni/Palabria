import { HomeView } from "@/components/home/home-view";
import { nextChallengeStart } from "@/lib/game/daily";
import { getChallengeForDate, roscoPreview, todayKey } from "@/lib/server/challenges";
import { serverNow } from "@/lib/server/clock";
import { getDb } from "@/lib/server/db";
import { currentPlayer } from "@/lib/server/identity";
import { getLeaderboard, getMe, getStats } from "@/lib/server/stats-service";
import { maybeSweep } from "@/lib/server/sweeper";

export const dynamic = "force-dynamic";

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error("[portada]", error);
    return null;
  }
}

export default async function HomePage() {
  const db = await getDb();
  const now = await serverNow(db);
  const date = todayKey(now);
  const challenge = await getChallengeForDate(db, date);
  const letters = await roscoPreview(db, challenge.id);
  const player = await currentPlayer();
  const me = player ? await getMe(db, player) : null;
  const stats = player ? await safe(() => getStats(db, player)) : null;
  const [boardRosco, boardProgram] = await Promise.all([
    safe(() => getLeaderboard(db, { date, mode: "rosco", playerId: player?.id ?? null, limit: 5 })),
    safe(() => getLeaderboard(db, { date, mode: "program", playerId: player?.id ?? null, limit: 5 })),
  ]);
  maybeSweep();
  return (
    <HomeView
      data={{
        challenge: {
          date,
          publicId: challenge.publicId,
          difficulty: challenge.difficulty,
          serverNow: now,
          nextResetAt: nextChallengeStart(now),
          letters,
        },
        me,
        stats,
        boardRosco,
        boardProgram,
      }}
    />
  );
}
