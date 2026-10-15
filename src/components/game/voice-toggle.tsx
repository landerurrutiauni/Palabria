"use client";

import { Mic, MicOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/client/cn";
import { getVoicePreference, setVoicePreference, subscribeVoicePreference, voiceSupport } from "@/lib/client/voice";

/** Preferencia de voz del modo individual (se guarda en este dispositivo). */
export function useVoicePreference(): boolean {
  return useSyncExternalStore(subscribeVoicePreference, getVoicePreference, () => false);
}

export function VoiceToggle({ className }: { className?: string }) {
  const enabled = useVoicePreference();
  const supported = useSyncExternalStore(
    subscribeVoicePreference,
    () => voiceSupport().speak,
    () => true,
  );
  if (!supported) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => setVoicePreference(!enabled)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-extrabold transition",
        enabled ? "border-ok-500 bg-ok-50 text-ok-700" : "border-glaze-300 bg-ink-900/[0.06] text-ink-700",
        className,
      )}
    >
      {enabled ? <Mic className="size-4" aria-hidden="true" /> : <MicOff className="size-4" aria-hidden="true" />}
      {enabled ? "Voz activada" : "Jugar con voz"}
    </button>
  );
}
