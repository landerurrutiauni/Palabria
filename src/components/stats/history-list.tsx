import Link from "next/link";
import { ChevronRight, Swords, User } from "lucide-react";
import { formatClock } from "@/lib/game/clock";
import { formatChallengeDate } from "@/lib/game/daily";
import { modeLabel } from "@/lib/game/phases";
import { cn } from "@/lib/client/cn";
import { historyHref, roomHref } from "@/lib/client/runtime";
import type { HistoryEntry } from "@/lib/views";

export function HistoryList({ entries, className }: { entries: HistoryEntry[]; className?: string }) {
  if (entries.length === 0) {
    return (
      <p className={cn("rounded-lg border border-dashed border-glaze-300 p-6 text-center text-ink-600", className)}>
        Todavía no has terminado ninguna partida.{" "}
        <Link href="/jugar" className="font-semibold text-cobalt-600">
          Juega la de hoy
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {entries.map((e) => {
        const link = e.kind === "duel" ? (e.roomCode ? roomHref(e.roomCode) : null) : historyHref(e.id);
        const body = (
          <>
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl",
                e.kind === "duel" ? "bg-saffron-400/20 text-saffron-700" : "bg-cobalt-600/10 text-cobalt-600",
              )}
              aria-hidden="true"
            >
              {e.kind === "duel" ? <Swords className="size-5" /> : <User className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink-900">
                {formatChallengeDate(e.date, { weekday: false })}, {e.kind === "duel" ? "1 vs 1" : "individual"},{" "}
                {modeLabel(e.mode)}
              </span>
              <span className="block text-sm text-ink-600">
                ✓ {e.correct} ✕ {e.wrong}, sin resolver {e.unanswered}, {formatClock(e.timeUsedMs)}
                {e.kind === "duel" && e.opponentName ? `, contra ${e.opponentName}` : ""}
                {e.status === "abandoned" ? ", abandonada" : ""}
              </span>
            </span>
            <span className="text-right">
              {e.kind === "duel" ? (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold",
                    e.outcome === "win" && "bg-ok-50 text-ok-700",
                    e.outcome === "loss" && "bg-bad-50 text-bad-700",
                    e.outcome === "draw" && "bg-ink-900/[0.07] text-ink-700",
                  )}
                >
                  {e.outcome === "win" ? "Victoria" : e.outcome === "loss" ? "Derrota" : "Empate"}
                </span>
              ) : (
                <span className="score-digits text-2xl text-saffron-700">{e.score}</span>
              )}
            </span>
            {link ? <ChevronRight className="size-5 text-ink-500" aria-hidden="true" /> : null}
          </>
        );
        return (
          <li key={e.id}>
            {link ? (
              <Link
                href={link}
                className="panel-soft flex items-center gap-3 p-3 transition hover:border-cobalt-600/40"
              >
                {body}
              </Link>
            ) : (
              <div className="panel-soft flex items-center gap-3 p-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
