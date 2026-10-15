import { SettingsProvider } from "@/components/providers/settings-provider";
import { PREFS_CACHE_KEY } from "@/lib/site";
import type { PreferencesView } from "@/lib/views";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Aplica las preferencias guardadas en este navegador antes del primer pintado
 * (versión estática: el HTML no conoce al jugador).
 */
const applyCachedPrefs = `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_CACHE_KEY)})||"null");if(p){var d=document.documentElement.dataset;d.motion=p.motion;d.contrast=p.highContrast?"high":"normal";d.text=p.largeText?"large":"normal"}}catch(e){}`;

/** Estructura común de todas las pantallas. */
export function AppShell({
  prefs,
  remotePrefs = false,
  children,
}: {
  prefs: PreferencesView;
  /** Las preferencias se cargan desde la API en el navegador (versión estática). */
  remotePrefs?: boolean;
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      data-motion={prefs.motion}
      data-contrast={prefs.highContrast ? "high" : "normal"}
      data-text={prefs.largeText ? "large" : "normal"}
      suppressHydrationWarning={remotePrefs}
    >
      <body className="flex min-h-dvh flex-col antialiased">
        {/* Se ejecuta antes de pintar el contenido de la página. */}
        {remotePrefs ? <script dangerouslySetInnerHTML={{ __html: applyCachedPrefs }} /> : null}
        <a
          href="#contenido"
          className="sr-only z-50 rounded-full bg-saffron-400 px-4 py-2 font-semibold text-ink-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Saltar al contenido
        </a>
        <SettingsProvider initial={prefs} remote={remotePrefs}>
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
