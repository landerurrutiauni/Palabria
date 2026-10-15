"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { useEffect } from "react";
import { StateScreen } from "@/components/ui/notice";

/** Error de conexión o del servidor al cargar una pantalla. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StateScreen
      icon={<WifiOff className="size-9 text-gold-300" />}
      eyebrow="Error de conexión"
      title="No hemos podido cargar esta pantalla"
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={reset}>
            Reintentar
          </button>
          <Link href="/" className="btn btn-ghost">
            Portada
          </Link>
        </>
      }
    >
      Comprueba tu conexión a internet. Si tenías una partida en marcha, está guardada en el servidor: al volver la
      recuperarás tal y como estaba (el reloj sigue su curso).
    </StateScreen>
  );
}
