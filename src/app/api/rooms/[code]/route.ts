import { errorResponse, json } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { getRoomView } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";

/** Estado de la sala para el visitante (también aplica fin de reloj y abandono si toca). */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const player = await requirePlayer();
    return json({ room: (await getRoomView(player, code)).view });
  } catch (error) {
    return errorResponse(error);
  }
}
