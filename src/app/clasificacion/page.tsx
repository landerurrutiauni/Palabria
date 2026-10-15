import type { Metadata } from "next";
import { LeaderboardPageView } from "@/components/pages/leaderboard-page-view";
import { isDateKey } from "@/lib/game/daily";
import { todayKey } from "@/lib/server/challenges";
import { serverNow } from "@/lib/server/clock";
import { getDb } from "@/lib/server/db";
import { currentPlayer } from "@/lib/server/identity";
import { getLeaderboard } from "@/lib/server/stats-service";
import { maybeSweep } from "@/lib/server/sweeper";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clasificación" };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; modo?: string }>;
}) {
  const sp = await searchParams;
  const db = await getDb();
  const today = todayKey(await serverNow(db));
  const date = sp.fecha && isDateKey(sp.fecha) && sp.fecha <= today ? sp.fecha : today;
  const mode = sp.modo === "programa" ? "program" : "rosco";
  const player = await currentPlayer();
  maybeSweep();
  let board = null;
  try {
    board = await getLeaderboard(db, { date, mode, playerId: player?.id ?? null, limit: 50 });
  } catch (error) {
    console.error("[clasificación]", error);
  }
  return <LeaderboardPageView board={board} date={date} today={today} mode={mode} />;
}
