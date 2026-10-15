import Link from "next/link";
import { ChevronRight, Swords, User } from "lucide-react";
import { formatClock } from "@/lib/game/clock";
import { formatChallengeDate } from "@/lib/game/daily";
import { modeLabel } from "@/lib/game/phases";
import { cn } from "@/lib/client/cn";
import type { HistoryEntry } from "@/lib/views";

export function HistoryList({ entries, className }: { entries: HistoryEntry[]; className?: string }) {
  if (entries.length === 0) {
    return (
      <p className={cn("rounded-2xl border border-dashed border-white/15 p-6 text-center text-ink-300", className)}>
        Todavía no has terminado ninguna partida.{" "}
        <Link href="/jugar" className="font-semibold text-turquoise-300">
          Juega la de hoy
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {entries.map((e) => {
        const body = (
          <>
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl",
                e.kind === "duel" ? "bg-gold-400/15 text-gold-300" : "bg-turquoise-400/15 text-turquoise-300",
              )}
              aria-hidden="true"
            >
              {e.kind === "duel" ? <Swords className="size-5" /> : <User className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink-50">
                {formatChallengeDate(e.date, { weekday: false })} · {e.kind === "duel" ? "1 vs 1" : "Individual"} ·{" "}
                {modeLabel(e.mode)}
              </span>
              <span className="block text-sm text-ink-300">
                ✓ {e.correct} · ✕ {e.wrong} · sin resolver {e.unanswered} · {formatClock(e.timeUsedMs)}
                {e.kind === "duel" && e.opponentName ? ` · contra ${e.opponentName}` : ""}
                {e.status === "abandoned" ? " · abandonada" : ""}
              </span>
            </span>
            <span className="text-right">
              {e.kind === "duel" ? (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold uppercase",
                    e.outcome === "win" && "bg-ok-500/15 text-ok-400",
                    e.outcome === "loss" && "bg-bad-500/15 text-bad-400",
                    e.outcome === "draw" && "bg-white/10 text-ink-200",
                  )}
                >
                  {e.outcome === "win" ? "Victoria" : e.outcome === "loss" ? "Derrota" : "Empate"}
                </span>
              ) : (
                <span className="score-digits text-2xl text-gold-300">{e.score}</span>
              )}
            </span>
            {e.link ? <ChevronRight className="size-5 text-ink-400" aria-hidden="true" /> : null}
          </>
        );
        return (
          <li key={e.id}>
            {e.link ? (
              <Link
                href={e.link}
                className="panel-soft flex items-center gap-3 p-3 transition hover:border-turquoise-400/40"
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
