"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useSettings } from "@/components/providers/settings-provider";
import { Notice } from "@/components/ui/notice";
import { api, ApiError } from "@/lib/client/api";
import { sound } from "@/lib/client/sound";
import { cn } from "@/lib/client/cn";
import { IS_STATIC } from "@/lib/client/runtime";

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-4">
      <span>
        <span className="block font-semibold text-ink-50">{label}</span>
        <span className="block text-sm text-ink-300">{description}</span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-8 w-14 rounded-full bg-white/15 transition peer-checked:bg-turquoise-400 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-400" />
        <span className="absolute left-1 top-1 size-6 rounded-full bg-white shadow transition peer-checked:translate-x-6" />
      </span>
    </label>
  );
}

export function SettingsForm({ displayName }: { displayName: string }) {
  const { prefs, update, play } = useSettings();
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNameError(null);
    setSaved(false);
    try {
      const me = await api<{ displayName: string }>("/api/me", { method: "PATCH", body: { displayName: name } });
      setName(me.displayName);
      setSaved(true);
      if (!IS_STATIC) router.refresh();
    } catch (error) {
      setNameError(error instanceof ApiError ? error.message : "No se pudo guardar el nombre.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel p-6" aria-labelledby="nombre">
        <h2 id="nombre" className="font-display text-lg font-bold text-ink-50">
          Nombre visible
        </h2>
        <p className="mt-1 text-sm text-ink-300">
          Opcional. Es lo que verán tus rivales y la clasificación. No pongas datos personales.
        </p>
        <form onSubmit={saveName} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="display-name" className="sr-only">
            Nombre visible
          </label>
          <input
            id="display-name"
            className="field !text-lg"
            value={name}
            maxLength={20}
            minLength={2}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby="name-help"
            autoComplete="nickname"
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </form>
        <p id="name-help" className="mt-2 text-xs text-ink-400">
          Entre 2 y 20 caracteres: letras, números, espacios, puntos y guiones.
        </p>
        {nameError ? (
          <Notice tone="error" title="Nombre no válido" className="mt-3">
            {nameError}
          </Notice>
        ) : null}
        {saved ? (
          <p className="mt-3 text-sm font-semibold text-ok-400" role="status">
            Nombre guardado.
          </p>
        ) : null}
      </section>

      <section className="panel p-6" aria-labelledby="sonido">
        <h2 id="sonido" className="font-display text-lg font-bold text-ink-50">
          Sonido
        </h2>
        <div className="divide-y divide-white/5">
          <Toggle
            label="Efectos de sonido"
            description="Aciertos, fallos, Pasapalabra, cuenta atrás y final de partida."
            checked={prefs.soundEnabled}
            onChange={(v) => update({ soundEnabled: v })}
          />
          <div className="flex items-center gap-4 py-4">
            {prefs.soundVolume === 0 ? (
              <VolumeX className="size-5 text-ink-300" aria-hidden="true" />
            ) : (
              <Volume2 className="size-5 text-ink-300" aria-hidden="true" />
            )}
            <label htmlFor="volume" className="sr-only">
              Volumen
            </label>
            <input
              id="volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={prefs.soundVolume}
              disabled={!prefs.soundEnabled}
              onChange={(e) => update({ soundVolume: Number(e.target.value) })}
              className="h-2 flex-1 accent-[var(--color-turquoise-400)]"
            />
            <span className="score-digits w-10 text-right text-xl">{prefs.soundVolume}</span>
            <button
              type="button"
              className="btn btn-ghost !min-h-10"
              disabled={!prefs.soundEnabled}
              onClick={() => {
                sound.unlock();
                window.setTimeout(() => play("correct"), 60);
              }}
            >
              Probar
            </button>
          </div>
        </div>
      </section>

      <section className="panel p-6 lg:col-span-2" aria-labelledby="accesibilidad">
        <h2 id="accesibilidad" className="font-display text-lg font-bold text-ink-50">
          Accesibilidad
        </h2>
        <fieldset className="mt-4">
          <legend className="font-semibold text-ink-50">Animaciones</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(
              [
                ["system", "Según el sistema", "Respeta «reducir movimiento» del dispositivo."],
                ["reduce", "Reducidas", "Sin pulsos, sacudidas ni transiciones."],
                ["full", "Completas", "Todas las animaciones activadas."],
              ] as const
            ).map(([value, label, text]) => (
              <label
                key={value}
                className={cn(
                  "panel-soft flex cursor-pointer gap-3 p-3",
                  prefs.motion === value && "border-turquoise-400/60",
                )}
              >
                <input
                  type="radio"
                  name="motion"
                  value={value}
                  checked={prefs.motion === value}
                  onChange={() => update({ motion: value })}
                  className="mt-1 accent-[var(--color-turquoise-400)]"
                />
                <span>
                  <span className="block font-semibold text-ink-50">{label}</span>
                  <span className="block text-sm text-ink-300">{text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-2 divide-y divide-white/5">
          <Toggle
            label="Alto contraste"
            description="Textos más brillantes y bordes más marcados."
            checked={prefs.highContrast}
            onChange={(v) => update({ highContrast: v })}
          />
          <Toggle
            label="Texto más grande"
            description="Aumenta el tamaño de todos los textos un 12,5 %."
            checked={prefs.largeText}
            onChange={(v) => update({ largeText: v })}
          />
        </div>
      </section>
    </div>
  );
}
