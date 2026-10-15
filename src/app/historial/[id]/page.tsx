import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SoloResult } from "@/components/solo/solo-result";
import { getDb } from "@/lib/server/db";
import { requirePlayerForPage } from "@/lib/server/page-identity";
import { getSoloSession } from "@/lib/server/solo-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resultado" };

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const player = await requirePlayerForPage();
  const db = await getDb();
  const res = await db.query<{ session_id: string | null }>("select session_id from game_results where id = $1 and player_id = $2", [
    id,
    player.id,
  ]);
  const sessionId = res.rows[0]?.session_id;
  if (!sessionId) notFound();
  const session = await getSoloSession(player, sessionId, db);
  if (!session?.result) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/historial" className="text-sm font-semibold text-turquoise-300 hover:underline">
        ← Volver al historial
      </Link>
      <div className="mt-4">
        <SoloResult result={session.result} />
      </div>
    </div>
  );
}
