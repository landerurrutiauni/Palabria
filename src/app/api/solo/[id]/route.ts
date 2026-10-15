import { z } from "zod";
import { Errors } from "@/lib/server/errors";
import { errorResponse, json } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { getSoloSession } from "@/lib/server/solo-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw Errors.badRequest();
    const player = await requirePlayer();
    const session = await getSoloSession(player, id);
    if (!session) return json({ error: { code: "not_found", message: "Partida no encontrada." } }, { status: 404 });
    return json({ session });
  } catch (error) {
    return errorResponse(error);
  }
}
