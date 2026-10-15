import { z } from "zod";
import { assertSameOrigin, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { getRoomView, setVoice } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";

/** Aceptar (o no) jugar con micrófono. Solo antes de empezar el duelo. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const player = await requirePlayer();
    rateLimit(`room-voice:${player.id}`, 30, 60_000);
    const { enabled } = await readJson(request, z.object({ enabled: z.boolean() }));
    await setVoice(player, code, enabled);
    return json({ room: (await getRoomView(player, code)).view });
  } catch (error) {
    return errorResponse(error);
  }
}
