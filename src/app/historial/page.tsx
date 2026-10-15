import type { Metadata } from "next";
import { HistoryList } from "@/components/stats/history-list";
import { getDb } from "@/lib/server/db";
import { requirePlayerForPage } from "@/lib/server/page-identity";
import { getStats } from "@/lib/server/stats-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Historial" };

export default async function HistoryPage() {
  const player = await requirePlayerForPage();
  const stats = await getStats(await getDb(), player);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Tus partidas</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink-50 sm:text-4xl">Historial</h1>
      <p className="mt-2 text-ink-300">
        Los desafíos anteriores se pueden consultar, pero no volver a jugar. Pulsa una partida para ver sus soluciones.
      </p>
      <HistoryList entries={stats.history} className="mt-6" />
    </div>
  );
}
