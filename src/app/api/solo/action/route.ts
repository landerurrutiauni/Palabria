import { z } from "zod";
import {
  actionIdSchema,
  actionRateLimit,
  actionSchema,
  assertSameOrigin,
  errorResponse,
  json,
  rateLimit,
  readJson,
} from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { soloAction } from "@/lib/server/solo-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  sessionId: z.uuid(),
  actionId: actionIdSchema,
  action: z.union([actionSchema, z.object({ type: z.literal("start_stage"), stage: z.number().int().min(0).max(10) })]),
});

/** Respuesta, «Palabria», pista o inicio de prueba. El servidor valida y puntúa. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const player = await requirePlayer();
    rateLimit(`solo-action:${player.id}`, actionRateLimit(), 10_000);
    const body = await readJson(request, schema);
    return json(await soloAction(player, body));
  } catch (error) {
    return errorResponse(error);
  }
}
