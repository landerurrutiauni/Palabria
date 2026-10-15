import { Lightbulb } from "lucide-react";
import { letterModeLabel } from "@/lib/game/alphabet";
import { cn } from "@/lib/client/cn";
import type { PromptView } from "@/lib/views";

/** Pregunta actual con tipografía muy legible. */
export function QuestionCard({ prompt, className }: { prompt: PromptView; className?: string }) {
  return (
    <section className={cn("panel relative overflow-hidden p-5 sm:p-6", className)} aria-label="Pregunta actual">
      {prompt.kind === "rosco" && (
        <div className="flex items-start gap-4">
          <div
            className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-white bg-[radial-gradient(circle_at_35%_30%,var(--color-turquoise-300),var(--color-turquoise-500)_70%)] font-display text-3xl font-bold text-night-950 shadow-glow-turquoise sm:size-20 sm:text-4xl"
            aria-hidden="true"
          >
            {prompt.letter}
          </div>
          <div className="min-w-0">
            <p className="eyebrow">
              {letterModeLabel(prompt.mode)} {prompt.letter}
            </p>
            <p className="mt-2 text-xl font-medium leading-snug text-ink-50 sm:text-2xl" key={prompt.index}>
              <span className="sr-only">
                {letterModeLabel(prompt.mode)} {prompt.letter}:{" "}
              </span>
              {prompt.definition}
            </p>
          </div>
        </div>
      )}
      {prompt.kind === "quick" && (
        <div>
          <p className="eyebrow">Definición</p>
          <p className="mt-2 text-xl font-medium leading-snug text-ink-50 sm:text-2xl">{prompt.definition}</p>
          <Hint text={prompt.hint} />
        </div>
      )}
      {prompt.kind === "saying" && (
        <div>
          <p className="eyebrow">Completa la expresión</p>
          <p className="mt-2 text-xl font-medium leading-snug text-ink-50 sm:text-2xl">
            {prompt.text.split("___").map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className="mx-1 inline-block min-w-20 border-b-4 border-dashed border-gold-400 align-baseline text-gold-300" aria-label="palabra que falta">
                    &nbsp;
                  </span>
                )}
              </span>
            ))}
          </p>
          <Hint text={prompt.hint} />
        </div>
      )}
      {prompt.kind === "link" && (
        <div>
          <p className="eyebrow">¿Qué palabra une a estas cuatro?</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {prompt.words.map((w) => (
              <li
                key={w}
                className="grid min-h-14 place-items-center rounded-2xl border border-violet-400/30 bg-violet-600/15 px-3 text-center text-lg font-semibold text-ink-50"
              >
                {w}
              </li>
            ))}
          </ul>
          <Hint text={prompt.hint} />
        </div>
      )}
      {prompt.kind === "clues" && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Pistas</p>
            <span className="chip text-gold-300">Vale {prompt.pointsNow} puntos</span>
          </div>
          <ol className="mt-3 space-y-2">
            {prompt.clues.map((clue, i) => (
              <li key={i} className="flex animate-rise gap-3 text-lg leading-snug text-ink-50">
                <span className="score-digits grid size-8 shrink-0 place-items-center rounded-full bg-violet-600/40 text-base">
                  {i + 1}
                </span>
                <span className="pt-0.5">{clue}</span>
              </li>
            ))}
            {Array.from({ length: prompt.totalClues - prompt.clues.length }, (_, i) => (
              <li key={`h${i}`} className="flex gap-3 text-ink-400" aria-hidden="true">
                <span className="score-digits grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-ink-400/50 text-base">
                  {prompt.clues.length + i + 1}
                </span>
                <span className="mt-3 h-2 w-40 rounded-full bg-white/5" />
              </li>
            ))}
          </ol>
          <Hint text={prompt.hint} />
        </div>
      )}
    </section>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm font-semibold text-ink-200">
      <Lightbulb className="size-4 text-gold-400" aria-hidden="true" />
      {text}
    </p>
  );
}
