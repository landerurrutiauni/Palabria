import "@fontsource-variable/nunito/wght.css";
import "@fontsource-variable/nunito/wght-italic.css";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { getDb } from "@/lib/server/db";
import { currentPlayer } from "@/lib/server/identity";
import { getPreferences } from "@/lib/server/stats-service";
import { DEFAULT_PREFERENCES, siteMetadata, siteViewport } from "@/lib/site";
import type { PreferencesView } from "@/lib/views";

export const metadata = siteMetadata;
export const viewport = siteViewport;

async function loadPreferences(): Promise<PreferencesView> {
  try {
    const player = await currentPlayer();
    if (!player) return DEFAULT_PREFERENCES;
    return await getPreferences(await getDb(), player.id);
  } catch {
    // Una función secundaria nunca debe romper la página.
    return DEFAULT_PREFERENCES;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return <AppShell prefs={await loadPreferences()}>{children}</AppShell>;
}
