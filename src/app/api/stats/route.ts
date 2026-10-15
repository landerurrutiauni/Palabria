import { getDb } from "@/lib/server/db";
import { errorResponse, json } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { getStats } from "@/lib/server/stats-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const player = await requirePlayer();
    return json(await getStats(await getDb(), player));
  } catch (error) {
    return errorResponse(error);
  }
}
