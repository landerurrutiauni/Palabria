import type { Metadata } from "next";
import { StatsPageView } from "@/components/pages/stats-page-view";
import { getDb } from "@/lib/server/db";
import { requirePlayerForPage } from "@/lib/server/page-identity";
import { getStats } from "@/lib/server/stats-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estadísticas" };

export default async function StatsPage() {
  const player = await requirePlayerForPage();
  return <StatsPageView stats={await getStats(await getDb(), player)} />;
}
