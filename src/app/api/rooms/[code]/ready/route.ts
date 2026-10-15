import { z } from "zod";
import { assertSameOrigin, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { getRoomView, setReady } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const player = await requirePlayer();
    rateLimit(`room-ready:${player.id}`, 30, 60_000);
    const { ready } = await readJson(request, z.object({ ready: z.boolean() }));
    await setReady(player, code, ready);
    return json({ room: (await getRoomView(player, code)).view });
  } catch (error) {
    return errorResponse(error);
  }
}
