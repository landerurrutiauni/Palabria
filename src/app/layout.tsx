import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/unbounded";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "./globals.css";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getDb } from "@/lib/server/db";
import { currentPlayer } from "@/lib/server/identity";
import { getPreferences } from "@/lib/server/stats-service";
import type { PreferencesView } from "@/lib/views";

export const metadata: Metadata = {
  title: { default: "Palabría · El concurso diario de palabras", template: "%s · Palabría" },
  description:
    "Juega cada día a El Rosco y al programa completo, o reta a un amigo a un duelo 1 vs 1 por turnos. Sin registro.",
  applicationName: "Palabría",
};

export const viewport: Viewport = {
  themeColor: "#070b26",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  // El teclado del móvil redimensiona el contenido en lugar de taparlo.
  interactiveWidget: "resizes-content",
};

const FALLBACK_PREFS: PreferencesView = {
  soundEnabled: true,
  soundVolume: 70,
  motion: "system",
  highContrast: false,
  largeText: false,
};

async function loadPreferences(): Promise<PreferencesView> {
  try {
    const player = await currentPlayer();
    if (!player) return FALLBACK_PREFS;
    return await getPreferences(await getDb(), player.id);
  } catch {
    // Una función secundaria nunca debe romper la página.
    return FALLBACK_PREFS;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = await loadPreferences();
  return (
    <html
      lang="es"
      data-motion={prefs.motion}
      data-contrast={prefs.highContrast ? "high" : "normal"}
      data-text={prefs.largeText ? "large" : "normal"}
    >
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-full bg-gold-400 px-4 py-2 font-semibold text-night-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Saltar al contenido
        </a>
        <SettingsProvider initial={prefs}>
          <SiteHeader />
          <main id="contenido" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </SettingsProvider>
      </body>
    </html>
  );
}
