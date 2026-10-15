import { z } from "zod";
import { assertSameOrigin, errorResponse, json, modeSchema, rateLimit, readJson } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { createRoom } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";

/** Crea una sala privada. No consume el intento 1 vs 1 hasta que empieza la partida. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const player = await requirePlayer();
    rateLimit(`room-create:${player.id}`, 10, 60_000);
    const { mode } = await readJson(request, z.object({ mode: modeSchema }));
    return json(await createRoom(player, mode), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
