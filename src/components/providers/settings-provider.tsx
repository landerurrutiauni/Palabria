"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { sound, type SoundName } from "@/lib/client/sound";
import { PREFS_CACHE_KEY } from "@/lib/site";
import type { MeView, PreferencesView } from "@/lib/views";

interface SettingsContextValue {
  prefs: PreferencesView;
  update: (patch: Partial<PreferencesView>) => void;
  play: (name: SoundName) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyToDocument(prefs: PreferencesView) {
  const root = document.documentElement;
  root.dataset.motion = prefs.motion;
  root.dataset.contrast = prefs.highContrast ? "high" : "normal";
  root.dataset.text = prefs.largeText ? "large" : "normal";
}

function cachePrefs(prefs: PreferencesView) {
  try {
    window.localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(prefs));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function SettingsProvider({
  initial,
  remote = false,
  children,
}: {
  initial: PreferencesView;
  /** Versión estática: las preferencias del jugador se piden a la API al cargar. */
  remote?: boolean;
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<PreferencesView>(initial);
  // Hasta recibirlas no se tocan los atributos que ya aplicó la copia local.
  const [loaded, setLoaded] = useState(!remote);

  useEffect(() => {
    if (!remote) return;
    let alive = true;
    api<MeView>("/api/me")
      .then((me) => {
        if (!alive) return;
        setPrefs(me.preferences);
        cachePrefs(me.preferences);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [remote]);

  useEffect(() => {
    if (!loaded) return;
    sound.enabled = prefs.soundEnabled;
    sound.volume = prefs.soundVolume / 100;
    applyToDocument(prefs);
  }, [prefs, loaded]);

  useEffect(() => {
    // El audio solo se desbloquea tras un gesto del usuario (política de los navegadores).
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const update = useCallback(
    (patch: Partial<PreferencesView>) => {
      setPrefs((current) => {
        const next = { ...current, ...patch };
        void api("/api/me/preferences", { method: "PUT", body: next }).catch(() => undefined);
        if (remote) cachePrefs(next);
        return next;
      });
      setLoaded(true);
    },
    [remote],
  );

  const play = useCallback((name: SoundName) => sound.play(name), []);
  const value = useMemo(() => ({ prefs, update, play }), [prefs, update, play]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings debe usarse dentro de SettingsProvider");
  return ctx;
}
