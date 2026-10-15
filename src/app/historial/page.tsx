import type { Metadata } from "next";
import { HistoryPageView } from "@/components/pages/history-page-view";
import { getDb } from "@/lib/server/db";
import { requirePlayerForPage } from "@/lib/server/page-identity";
import { getStats } from "@/lib/server/stats-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Historial" };

export default async function HistoryPage() {
  const player = await requirePlayerForPage();
  const stats = await getStats(await getDb(), player);
  return <HistoryPageView entries={stats.history} />;
}
