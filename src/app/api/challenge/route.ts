import { nextChallengeStart } from "@/lib/game/daily";
import { getChallengeForDate, roscoPreview, todayKey } from "@/lib/server/challenges";
import { serverNow } from "@/lib/server/clock";
import { getDb } from "@/lib/server/db";
import { errorResponse, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Desafío vigente (fecha oficial calculada en el servidor, nunca en el navegador). */
export async function GET() {
  try {
    const db = await getDb();
    const now = await serverNow(db);
    const date = todayKey(now);
    const challenge = await getChallengeForDate(db, date);
    return json({
      date,
      publicId: challenge.publicId,
      difficulty: challenge.difficulty,
      contentVersion: challenge.contentVersion,
      serverNow: now,
      nextResetAt: nextChallengeStart(now),
      letters: await roscoPreview(db, challenge.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
