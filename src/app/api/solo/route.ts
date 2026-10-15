import { z } from "zod";
import { assertSameOrigin, errorResponse, json, modeSchema, rateLimit, readJson } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { getTodaySolo, startSolo } from "@/lib/server/solo-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const player = await requirePlayer();
    return json({ session: await getTodaySolo(player) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Empieza la partida individual del día (consume el intento en el servidor). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const player = await requirePlayer();
    rateLimit(`solo-start:${player.id}`, 10, 60_000);
    const { mode } = await readJson(request, z.object({ mode: modeSchema }));
    return json({ session: await startSolo(player, mode) });
  } catch (error) {
    return errorResponse(error);
  }
}
