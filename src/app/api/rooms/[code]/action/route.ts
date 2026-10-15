import { z } from "zod";
import { actionIdSchema, actionRateLimit, actionSchema, assertSameOrigin, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { roomAction } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";

const schema = z.object({ actionId: actionIdSchema, action: actionSchema });

/** Acción en el turno propio. Fuera de turno, el servidor la rechaza. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await params;
    const player = await requirePlayer();
    rateLimit(`room-action:${player.id}`, actionRateLimit(), 10_000);
    const body = await readJson(request, schema);
    return json(await roomAction(player, code, body));
  } catch (error) {
    return errorResponse(error);
  }
}
