import type { Metadata } from "next";
import { SettingsPageView } from "@/components/pages/settings-page-view";
import { requirePlayerForPage } from "@/lib/server/page-identity";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const player = await requirePlayerForPage();
  return <SettingsPageView displayName={player.displayName} />;
}
