import type { Metadata, Viewport } from "next";
import type { PreferencesView } from "@/lib/views";

/** Metadatos compartidos por la versión con servidor y la versión estática. */
export const siteMetadata: Metadata = {
  title: { default: "Palabria · El concurso diario de palabras", template: "%s · Palabria" },
  description:
    "Juega cada día a El Rosco y al programa completo, o reta a un amigo a un duelo 1 vs 1 por turnos. Sin registro.",
  applicationName: "Palabria",
};

export const siteViewport: Viewport = {
  themeColor: "#1d3fa6",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  // El teclado del móvil redimensiona el contenido en lugar de taparlo.
  interactiveWidget: "resizes-content",
};

export const DEFAULT_PREFERENCES: PreferencesView = {
  soundEnabled: true,
  soundVolume: 70,
  motion: "system",
  highContrast: false,
  largeText: false,
};

/** Clave de la copia local de las preferencias (solo versión estática). */
export const PREFS_CACHE_KEY = "palabria-prefs";
