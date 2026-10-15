import type { Metadata } from "next";
import { PlaySelectionView } from "@/components/pages/play-selection-view";
import { timingFromEnv } from "@/lib/game/config";
import { getDb } from "@/lib/server/db";
import { requirePlayerForPage } from "@/lib/server/page-identity";
import { getMe } from "@/lib/server/stats-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jugar en solitario" };

export default async function PlaySelectionPage() {
  const player = await requirePlayerForPage();
  return <PlaySelectionView me={await getMe(await getDb(), player)} timing={timingFromEnv()} />;
}
