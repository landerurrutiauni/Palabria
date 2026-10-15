import { assertSameOrigin, errorResponse, json } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { leaveRoom } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const player = await requirePlayer();
    await leaveRoom(player, code);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
