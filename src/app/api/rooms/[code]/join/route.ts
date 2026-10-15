import { assertSameOrigin, errorResponse, json, rateLimit } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { getRoomView, joinRoom } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const player = await requirePlayer();
    rateLimit(`room-join:${player.id}`, 20, 60_000);
    await joinRoom(player, code);
    return json({ room: (await getRoomView(player, code)).view });
  } catch (error) {
    return errorResponse(error);
  }
}
