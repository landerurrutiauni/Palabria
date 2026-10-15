import { todayKey } from "@/lib/server/challenges";
import { serverNow } from "@/lib/server/clock";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const now = await serverNow(db);
    return json({ ok: true, database: db.kind, today: todayKey(now), serverNow: now });
  } catch {
    return json({ ok: false }, { status: 503 });
  }
}
