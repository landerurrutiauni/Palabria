import { isDateKey } from "@/lib/game/daily";
import { todayKey } from "@/lib/server/challenges";
import { serverNow } from "@/lib/server/clock";
import { getDb } from "@/lib/server/db";
import { errorResponse, json } from "@/lib/server/http";
import { currentPlayer } from "@/lib/server/identity";
import { getLeaderboard } from "@/lib/server/stats-service";
import { maybeSweep } from "@/lib/server/sweeper";

export const dynamic = "force-dynamic";

/** Clasificación pública: solo nombres visibles y datos de juego. */
export async function GET(request: Request) {
  try {
    maybeSweep();
    const url = new URL(request.url);
    const db = await getDb();
    const date = url.searchParams.get("date") ?? todayKey(await serverNow(db));
    const mode = url.searchParams.get("mode") === "program" ? "program" : "rosco";
    if (!isDateKey(date)) return json({ error: { code: "bad_request", message: "Fecha no válida." } }, { status: 400 });
    const player = await currentPlayer();
    return json(await getLeaderboard(db, { date, mode, playerId: player?.id ?? null, limit: 50 }));
  } catch (error) {
    return errorResponse(error);
  }
}
