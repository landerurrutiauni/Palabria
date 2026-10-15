"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { sound, type SoundName } from "@/lib/client/sound";
import type { PreferencesView } from "@/lib/views";

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

export function SettingsProvider({ initial, children }: { initial: PreferencesView; children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<PreferencesView>(initial);

  useEffect(() => {
    sound.enabled = prefs.soundEnabled;
    sound.volume = prefs.soundVolume / 100;
    applyToDocument(prefs);
  }, [prefs]);

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

  const update = useCallback((patch: Partial<PreferencesView>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      void api("/api/me/preferences", { method: "PUT", body: next }).catch(() => undefined);
      return next;
    });
  }, []);

  const play = useCallback((name: SoundName) => sound.play(name), []);
  const value = useMemo(() => ({ prefs, update, play }), [prefs, update, play]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings debe usarse dentro de SettingsProvider");
  return ctx;
}
