"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

/** Comparte el resultado con la hoja nativa del dispositivo o lo copia al portapapeles. */
export function ShareButton({ text, title = "Mi resultado en Palabría", className = "btn btn-gold" }: { text: string; title?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const full = text.includes("http") ? text : `${text}\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: full });
        return;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copia tu resultado:", full);
    }
  };
  return (
    <button type="button" className={className} onClick={share}>
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
      {copied ? "¡Copiado!" : "Compartir resultado"}
      <span className="sr-only" aria-live="polite">
        {copied ? "Resultado copiado al portapapeles" : ""}
      </span>
    </button>
  );
}
