import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import { assertSameOrigin, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { sanitizeDisplayName } from "@/lib/server/names";
import { getMe } from "@/lib/server/stats-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const player = await requirePlayer();
    return json(await getMe(await getDb(), player));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Cambia el nombre visible (opcional, validado en el servidor). */
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const player = await requirePlayer();
    rateLimit(`name:${player.id}`, 10, 60_000);
    const body = await readJson(request, z.object({ displayName: z.string().max(80) }));
    const result = sanitizeDisplayName(body.displayName);
    if (!result.ok) throw new AppError(400, "invalid_name", result.error);
    const db = await getDb();
    await db.query("update anonymous_players set display_name = $2, name_is_custom = true where id = $1", [
      player.id,
      result.name,
    ]);
    return json(await getMe(db, { ...player, displayName: result.name, nameIsCustom: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
