import { HomeView } from "@/components/home/home-view";
import { nextChallengeStart } from "@/lib/game/daily";
import { getChallengeForDate, roscoPreview, todayKey } from "@/lib/server/challenges";
import { serverNow } from "@/lib/server/clock";
import { getDb } from "@/lib/server/db";
import { currentPlayer } from "@/lib/server/identity";
import { getMe } from "@/lib/server/stats-service";
import { maybeSweep } from "@/lib/server/sweeper";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getDb();
  const now = await serverNow(db);
  const date = todayKey(now);
  const challenge = await getChallengeForDate(db, date);
  const letters = await roscoPreview(db, challenge.id);
  const player = await currentPlayer();
  const me = player ? await getMe(db, player) : null;
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
      }}
    />
  );
}
