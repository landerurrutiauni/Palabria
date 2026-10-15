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
            className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-glaze-0 bg-[radial-gradient(circle_at_35%_30%,var(--color-cobalt-500),var(--color-cobalt-700)_70%)] font-display text-3xl font-bold text-white shadow-glow-turn sm:size-20 sm:text-4xl"
            aria-hidden="true"
          >
            {prompt.letter}
          </div>
          <div className="min-w-0">
            <p className="eyebrow">
              {letterModeLabel(prompt.mode)} {prompt.letter}
            </p>
            <p
              className="mt-2 font-display text-[1.6rem] font-medium leading-snug text-ink-900 sm:text-[1.9rem]"
              key={prompt.index}
            >
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
          <p className="mt-2 font-display text-[1.6rem] font-medium leading-snug text-ink-900 sm:text-[1.9rem]">
            {prompt.definition}
          </p>
          <Hint text={prompt.hint} />
        </div>
      )}
      {prompt.kind === "saying" && (
        <div>
          <p className="eyebrow">Completa la expresión</p>
          <p className="mt-2 font-display text-[1.6rem] font-medium leading-snug text-ink-900 sm:text-[1.9rem]">
            {prompt.text.split("___").map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span
                    className="mx-1 inline-block min-w-20 border-b-4 border-dashed border-saffron-500 align-baseline text-saffron-700"
                    aria-label="palabra que falta"
                  >
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
                className="grid min-h-14 place-items-center rounded-lg border border-cobalt-600/20 bg-cobalt-600/10 px-3 text-center text-lg font-semibold text-ink-900"
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
            <span className="chip text-saffron-700">Vale {prompt.pointsNow} puntos</span>
          </div>
          <ol className="mt-3 space-y-2">
            {prompt.clues.map((clue, i) => (
              <li key={i} className="flex animate-rise gap-3 text-lg leading-snug text-ink-900">
                <span className="score-digits grid size-8 shrink-0 place-items-center rounded-full bg-cobalt-600/15 text-base">
                  {i + 1}
                </span>
                <span className="pt-0.5">{clue}</span>
              </li>
            ))}
            {Array.from({ length: prompt.totalClues - prompt.clues.length }, (_, i) => (
              <li key={`h${i}`} className="flex gap-3 text-ink-500" aria-hidden="true">
                <span className="score-digits grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-glaze-400 text-base">
                  {prompt.clues.length + i + 1}
                </span>
                <span className="mt-3 h-2 w-40 rounded-full bg-ink-900/[0.04]" />
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
    <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink-900/[0.04] px-3 py-1.5 text-sm font-semibold text-ink-700">
      <Lightbulb className="size-4 text-saffron-700" aria-hidden="true" />
      {text}
    </p>
  );
}
