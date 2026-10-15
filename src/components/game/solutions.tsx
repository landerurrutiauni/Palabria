import { Check, CircleDashed, RotateCcw, X } from "lucide-react";
import { letterModeLabel } from "@/lib/game/alphabet";
import { cn } from "@/lib/client/cn";
import type { PhaseReview, RevealedLetter } from "@/lib/views";

function StatusIcon({ status }: { status: RevealedLetter["status"] | PhaseReview["items"][number]["outcome"] }) {
  if (status === "correct") return <Check className="size-4 text-ok-400" strokeWidth={3} aria-label="Acertada" />;
  if (status === "wrong") return <X className="size-4 text-bad-400" strokeWidth={3} aria-label="Fallada" />;
  if (status === "passed") return <RotateCcw className="size-4 text-gold-300" aria-label="Pasada" />;
  return <CircleDashed className="size-4 text-ink-400" aria-label="Sin responder" />;
}

/** Soluciones del rosco (solo se muestran al terminar la partida). */
export function RoscoSolutions({ letters, title = "Soluciones del rosco" }: { letters: RevealedLetter[]; title?: string }) {
  return (
    <details className="panel group p-5 sm:p-6" open>
      <summary className="cursor-pointer list-none font-display text-lg font-bold text-ink-50">
        {title}
        <span className="ml-2 text-sm font-normal text-ink-300 group-open:hidden">(mostrar)</span>
      </summary>
      <ul className="mt-4 divide-y divide-white/5">
        {letters.map((l) => (
          <li key={l.letter} className="grid grid-cols-[2.5rem_1fr] gap-3 py-3">
            <span
              className={cn(
                "grid size-10 place-items-center rounded-full font-display font-bold",
                l.status === "correct" && "bg-ok-500 text-white",
                l.status === "wrong" && "bg-bad-500 text-white",
                (l.status === "pending" || l.status === "passed") && "border-2 border-dashed border-ink-400/60 text-ink-300",
              )}
            >
              {l.letter}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-ink-300">
                {letterModeLabel(l.mode)} {l.letter}: {l.definition}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold text-ink-50">{l.answer}</span>
                {l.given && l.status !== "correct" ? (
                  <span className="text-sm text-bad-400">
                    tu respuesta: <span className="line-through">{l.given}</span>
                  </span>
                ) : null}
                <StatusIcon status={l.status} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function PhaseSolutions({ phases }: { phases: PhaseReview[] }) {
  if (phases.length === 0) return null;
  return (
    <details className="panel p-5 sm:p-6">
      <summary className="cursor-pointer font-display text-lg font-bold text-ink-50">Soluciones de las pruebas</summary>
      <div className="mt-4 space-y-6">
        {phases.map((p) => (
          <section key={p.kind}>
            <h3 className="flex items-center justify-between font-semibold text-ink-50">
              {p.title}
              <span className="score-digits text-xl text-gold-300">{p.points} pts</span>
            </h3>
            <ul className="mt-2 space-y-2">
              {p.items.map((it, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-sm">
                  <StatusIcon status={it.outcome} />
                  <div className="min-w-0">
                    <p className="text-ink-300">{it.prompt}</p>
                    <p className="mt-0.5 font-bold text-ink-50">
                      {it.answer}
                      {it.given && it.outcome !== "correct" ? (
                        <span className="ml-2 font-normal text-bad-400 line-through">{it.given}</span>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
