"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import type { DuelView } from "@/lib/views";

export type SyncStatus = "live" | "connecting" | "reconnecting" | "offline";

/**
 * Sincronización de la sala en tiempo real: Server-Sent Events con
 * reconexión automática y sondeo de respaldo si el canal se interrumpe.
 * El servidor es siempre la fuente de verdad; aquí solo se acepta la vista
 * más reciente (por número de versión).
 */
export function useRoomSync(code: string, initial: DuelView) {
  const [view, setView] = useState<DuelView>(initial);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [fatal, setFatal] = useState<ApiError | null>(null);
  const versionRef = useRef(initial.version);

  const accept = useCallback((next: DuelView) => {
    if (next.version < versionRef.current) return;
    versionRef.current = next.version;
    setView(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ room: DuelView }>(`/api/rooms/${code}`);
      accept(res.room);
      return true;
    } catch (error) {
      if (error instanceof ApiError && !error.isNetwork && error.status >= 400 && error.status < 500) setFatal(error);
      return false;
    }
  }, [code, accept]);

  useEffect(() => {
    let source: EventSource | null = null;
    let poll: number | null = null;
    let closed = false;
    const startPolling = () => {
      if (poll !== null) return;
      poll = window.setInterval(async () => {
        const ok = await refresh();
        setStatus(ok ? "reconnecting" : navigator.onLine ? "reconnecting" : "offline");
      }, 2500);
    };
    const stopPolling = () => {
      if (poll !== null) window.clearInterval(poll);
      poll = null;
    };
    const open = () => {
      if (closed) return;
      source = new EventSource(`/api/rooms/${code}/events`);
      source.addEventListener("state", (event) => {
        setStatus("live");
        stopPolling();
        try {
          accept(JSON.parse((event as MessageEvent<string>).data) as DuelView);
        } catch {
          /* mensaje corrupto: se ignora */
        }
      });
      source.onerror = () => {
        // EventSource reintenta solo; mientras tanto, sondeo de respaldo.
        setStatus(navigator.onLine ? "reconnecting" : "offline");
        startPolling();
      };
    };
    open();
    const onOnline = () => void refresh();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onOnline);
    return () => {
      closed = true;
      source?.close();
      stopPolling();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onOnline);
    };
  }, [code, accept, refresh]);

  return { view, status, fatal, refresh, accept };
}
