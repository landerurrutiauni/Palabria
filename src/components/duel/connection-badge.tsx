import { cn } from "@/lib/client/cn";
import type { SyncStatus } from "@/lib/client/use-room-sync";

export function ConnectionBadge({ status }: { status: SyncStatus }) {
  const map: Record<SyncStatus, { text: string; dot: string }> = {
    live: { text: "En directo", dot: "bg-ok-600" },
    connecting: { text: "Conectando…", dot: "bg-saffron-400 animate-pulse" },
    reconnecting: { text: "Reconectando…", dot: "bg-saffron-400 animate-pulse" },
    offline: { text: "Sin conexión", dot: "bg-bad-600 animate-pulse" },
  };
  const s = map[status];
  return (
    <span className="chip" role="status" aria-live="polite">
      <span className={cn("size-2 rounded-full", s.dot)} aria-hidden="true" />
      {s.text}
    </span>
  );
}

export function PresenceDot({ connected }: { connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600">
      <span className={cn("size-2 rounded-full", connected ? "bg-ok-600" : "bg-ink-500")} aria-hidden="true" />
      {connected ? "Conectado" : "Desconectado"}
    </span>
  );
}
