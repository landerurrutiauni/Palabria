"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { BASE_PATH, roomHref } from "@/lib/client/runtime";

const noopSubscribe = () => () => undefined;

/** Enlace de invitación con botones para copiar y compartir. */
export function InvitePanel({ code }: { code: string }) {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const url = origin ? `${origin}${BASE_PATH}${roomHref(code)}` : roomHref(code);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.getElementById("invite-url") as HTMLInputElement | null;
      input?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };
  const share = async () => {
    try {
      await navigator.share({ title: "Duelo en Palabria", text: "¡Te reto a un duelo de El Rosco en Palabria!", url });
    } catch {
      /* cancelado */
    }
  };

  return (
    <div className="rounded-lg border border-saffron-500/40 bg-saffron-400/10 p-4">
      <label htmlFor="invite-url" className="text-sm font-semibold text-saffron-700">
        Enlace de invitación privado
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="invite-url"
          readOnly
          value={url}
          className="field !min-h-12 !text-base"
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="flex gap-2">
          <button type="button" className="btn btn-gold flex-1 sm:flex-none" onClick={copy}>
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
          {canShare ? (
            <button type="button" className="btn btn-ghost flex-1 sm:flex-none" onClick={share}>
              <Share2 className="size-4" aria-hidden="true" />
              Compartir
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-600" aria-live="polite">
        {copied
          ? "Enlace copiado. Envíaselo a tu rival."
          : "Quien abra este enlace podrá aceptar el duelo (sin registrarse)."}
      </p>
    </div>
  );
}
