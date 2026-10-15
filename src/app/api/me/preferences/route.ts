import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { assertSameOrigin, errorResponse, json, rateLimit, readJson } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { savePreferences } from "@/lib/server/stats-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  soundEnabled: z.boolean(),
  soundVolume: z.number().int().min(0).max(100),
  motion: z.enum(["system", "reduce", "full"]),
  highContrast: z.boolean(),
  largeText: z.boolean(),
});

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const player = await requirePlayer();
    rateLimit(`prefs:${player.id}`, 30, 60_000);
    const prefs = await readJson(request, schema);
    return json(await savePreferences(await getDb(), player.id, prefs));
  } catch (error) {
    return errorResponse(error);
  }
}
