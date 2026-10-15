"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListOrdered, Swords, Timer } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { api, ApiError } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { roomHref } from "@/lib/client/runtime";
import type { GameMode } from "@/lib/game/phases";

export function CreateRoomForm() {
  const router = useRouter();
  const [mode, setMode] = useState<GameMode>("rosco");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { code } = await api<{ code: string }>("/api/rooms", { body: { mode } });
      router.push(roomHref(code));
    } catch (e) {
      if (e instanceof ApiError) setError(e);
      setBusy(false);
    }
  };

  const options: { value: GameMode; title: string; text: string; icon: React.ReactNode }[] = [
    {
      value: "rosco",
      title: "Solo El Rosco",
      text: "Directos al rosco, unos 6 minutos",
      icon: <Timer className="size-5" aria-hidden="true" />,
    },
    {
      value: "program",
      title: "Programa completo",
      text: "4 pruebas por turnos y El Rosco, unos 12 minutos",
      icon: <ListOrdered className="size-5" aria-hidden="true" />,
    },
  ];

  return (
    <div className="mt-6">
      <fieldset>
        <legend className="text-sm font-semibold text-ink-700">Modalidad (la misma para los dos)</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                "panel-soft flex cursor-pointer gap-3 p-4 transition",
                mode === o.value ? "border-saffron-500/70 shadow-tile" : "hover:border-glaze-400",
              )}
            >
              <input
                type="radio"
                name="mode"
                value={o.value}
                checked={mode === o.value}
                onChange={() => setMode(o.value)}
                className="mt-1 size-4 accent-[var(--color-gold-400)]"
              />
              <span>
                <span className="flex items-center gap-2 font-bold text-ink-900">
                  {o.icon}
                  {o.title}
                </span>
                <span className="mt-1 block text-sm text-ink-600">{o.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error ? (
        <Notice tone="error" title="No se ha podido crear la sala" className="mt-4">
          {error.message}
        </Notice>
      ) : null}
      <button
        type="button"
        className="btn btn-gold mt-6 min-h-14 w-full px-8 text-lg sm:w-auto"
        onClick={create}
        disabled={busy}
      >
        <Swords className="size-5" aria-hidden="true" />
        {busy ? "Creando sala…" : "Crear sala y obtener enlace"}
      </button>
      <p className="mt-3 text-xs text-ink-500">
        Crear la sala no gasta tu intento: se consume cuando empieza el duelo.
      </p>
    </div>
  );
}
