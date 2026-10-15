import type { Metadata } from "next";
import { DuelHomeView } from "@/components/pages/duel-home-view";
import { timingFromEnv } from "@/lib/game/config";
import { getDb } from "@/lib/server/db";
import { requirePlayerForPage } from "@/lib/server/page-identity";
import { getMe } from "@/lib/server/stats-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Desafía a un amigo" };

export default async function DuelPage() {
  const player = await requirePlayerForPage();
  return <DuelHomeView me={await getMe(await getDb(), player)} timing={timingFromEnv()} />;
}
