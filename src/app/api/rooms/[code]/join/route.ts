import { z } from "zod";
import { assertSameOrigin, errorResponse, json, rateLimit, readOptionalJson } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { getRoomView, joinRoom } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const player = await requirePlayer();
    rateLimit(`room-join:${player.id}`, 20, 60_000);
    const { voice } = await readOptionalJson(request, z.object({ voice: z.boolean().optional() }));
    await joinRoom(player, code, undefined, { voice });
    return json({ room: (await getRoomView(player, code)).view });
  } catch (error) {
    return errorResponse(error);
  }
}
