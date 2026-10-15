import type { HistoryEntry } from "@/lib/views";
import { HistoryList } from "@/components/stats/history-list";

export function HistoryPageView({ entries }: { entries: HistoryEntry[] }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Tus partidas</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">Historial</h1>
      <p className="mt-2 text-ink-600">
        Los desafíos anteriores se pueden consultar, pero no volver a jugar. Pulsa una partida para ver sus soluciones.
      </p>
      <HistoryList entries={entries} className="mt-6" />
    </div>
  );
}
