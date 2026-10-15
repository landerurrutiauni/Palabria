"use client";

import Link from "next/link";
import { ShieldAlert, WifiOff } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { StateScreen } from "@/components/ui/notice";
import { ApiError } from "@/lib/client/api";

type LoadValue<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: Error };
export type LoadState<T> = LoadValue<T> & { retry: () => void };

/**
 * Carga datos de la API en el navegador (versión estática). `load` debe ser
 * una función estable (definida fuera del componente); `key` identifica los
 * parámetros y vuelve a cargar cuando cambia.
 */
export function useLoad<T>(load: (key: string) => Promise<T>, key: string): LoadState<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ id: string; value: LoadValue<T> } | null>(null);
  const id = `${key}#${attempt}`;
  useEffect(() => {
    let alive = true;
    const current = `${key}#${attempt}`;
    load(key).then(
      (data) => alive && setState({ id: current, value: { status: "ready", data } }),
      (error: unknown) =>
        alive &&
        setState({
          id: current,
          value: { status: "error", error: error instanceof Error ? error : new Error(String(error)) },
        }),
    );
    return () => {
      alive = false;
    };
  }, [load, key, attempt]);
  const value: LoadValue<T> = state && state.id === id ? state.value : { status: "loading" };
  return { ...value, retry: () => setAttempt((n) => n + 1) };
}

/** Pantalla de error de carga con opción de reintentar. */
export function LoadError({ error, retry }: { error: Error; retry: () => void }) {
  const auth = error instanceof ApiError && error.code === "auth";
  return (
    <StateScreen
      icon={auth ? <ShieldAlert className="size-9 text-gold-300" /> : <WifiOff className="size-9 text-gold-300" />}
      eyebrow={auth ? "Identidad anónima" : "Error de conexión"}
      title={auth ? "No hemos podido identificarte" : "No hemos podido cargar esta pantalla"}
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={retry}>
            Reintentar
          </button>
          <Link href="/" className="btn btn-ghost">
            Portada
          </Link>
        </>
      }
    >
      {auth
        ? "Palabría guarda tu identidad anónima en este navegador. Comprueba que no estás bloqueando el almacenamiento del sitio e inténtalo de nuevo."
        : error.message ||
          "Comprueba tu conexión a internet. Si tenías una partida en marcha, está guardada en el servidor."}
    </StateScreen>
  );
}

/** Muestra la carga, el error o el contenido según el estado. */
export function Loaded<T>({ state, children }: { state: LoadState<T>; children: (data: T) => ReactNode }) {
  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "error") return <LoadError error={state.error} retry={state.retry} />;
  return <>{children(state.data)}</>;
}
