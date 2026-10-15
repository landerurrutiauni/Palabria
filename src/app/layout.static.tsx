import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/ibarra-real-nova/latin-400.css";
import "@fontsource/ibarra-real-nova/latin-400-italic.css";
import "@fontsource/ibarra-real-nova/latin-600.css";
import "@fontsource/ibarra-real-nova/latin-700.css";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { DEFAULT_PREFERENCES, siteMetadata, siteViewport } from "@/lib/site";

// Versión estática (GitHub Pages): las preferencias del jugador se cargan en el navegador.
export const metadata = siteMetadata;
export const viewport = siteViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell prefs={DEFAULT_PREFERENCES} remotePrefs>
      {children}
    </AppShell>
  );
}
