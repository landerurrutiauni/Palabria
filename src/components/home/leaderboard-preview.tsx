import Link from "next/link";
import { Crown } from "lucide-react";
import { formatClock } from "@/lib/game/clock";
import { cn } from "@/lib/client/cn";
import type { LeaderboardView } from "@/lib/views";

export function LeaderboardTable({
  board,
  limit = 5,
  className,
}: {
  board: LeaderboardView;
  limit?: number;
  className?: string;
}) {
  if (board.entries.length === 0) {
    return (
      <p className={cn("rounded-lg border border-dashed border-glaze-300 p-4 text-sm text-ink-600", className)}>
        Aún no hay suficientes partidas terminadas hoy para la clasificación ({board.total} de {board.minEntries}).
        {board.you ? ` Tu puntuación: ${board.you.score}.` : " ¡Puedes ser de los primeros!"}
      </p>
    );
  }
  const rows = board.entries.slice(0, limit);
  const youOutside = board.you && !rows.some((r) => r.isYou);
  return (
    <table className={cn("w-full text-left text-sm", className)}>
      <caption className="sr-only">Clasificación del día</caption>
      <thead className="text-xs text-ink-500">
        <tr>
          <th scope="col" className="py-2 pr-2 font-semibold">
            #
          </th>
          <th scope="col" className="py-2 pr-2 font-semibold">
            Jugador
          </th>
          <th scope="col" className="py-2 pr-2 text-right font-semibold">
            Aciertos
          </th>
          <th scope="col" className="hidden py-2 pr-2 text-right font-semibold sm:table-cell">
            Tiempo
          </th>
          <th scope="col" className="py-2 text-right font-semibold">
            Puntos
          </th>
        </tr>
      </thead>
      <tbody>
        {[...rows, ...(youOutside && board.you ? [board.you] : [])].map((e) => (
          <tr
            key={`${e.rank}-${e.name}`}
            className={cn("border-t border-glaze-200", e.isYou && "bg-cobalt-600/[0.07]")}
          >
            <td className="score-digits py-2.5 pr-2 text-lg">
              {e.rank === 1 ? <Crown className="size-4 text-saffron-700" aria-label="Primer puesto" /> : e.rank}
            </td>
            <td className="max-w-[10rem] truncate py-2.5 pr-2 font-semibold text-ink-900">
              {e.name}
              {e.isYou && <span className="ml-2 text-xs font-bold text-cobalt-600">(tú)</span>}
            </td>
            <td className="score-digits py-2.5 pr-2 text-right text-lg">{e.correct}</td>
            <td className="score-digits hidden py-2.5 pr-2 text-right text-lg sm:table-cell">
              {formatClock(e.timeUsedMs)}
            </td>
            <td className="score-digits py-2.5 text-right text-lg text-saffron-700">{e.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LeaderboardLink() {
  return (
    <Link href="/clasificacion" className="text-sm font-semibold text-cobalt-600 hover:text-cobalt-600">
      Ver clasificación completa
    </Link>
  );
}
