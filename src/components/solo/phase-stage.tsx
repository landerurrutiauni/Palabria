"use client";

import { Eye } from "lucide-react";
import { AnswerForm } from "@/components/game/answer-form";
import { FeedbackBanner } from "@/components/game/feedback";
import { QuestionCard } from "@/components/game/question-card";
import { formatClock } from "@/lib/game/clock";
import { cn } from "@/lib/client/cn";
import type { FeedbackView, PhaseItemView, SoloView } from "@/lib/views";

export function ItemDots({
  items,
  current,
}: {
  items: { outcome: PhaseItemView["outcome"] }[];
  current: number | null;
}) {
  return (
    <ol className="flex gap-1.5" aria-label="Progreso de la prueba">
      {items.map((it, i) => (
        <li
          key={i}
          aria-label={`Pregunta ${i + 1}: ${it.outcome === "pending" ? (i === current ? "actual" : "pendiente") : it.outcome === "correct" ? "acertada" : "sin puntos"}`}
          className={cn(
            "h-2.5 flex-1 rounded-full",
            it.outcome === "correct" && "bg-ok-500",
            (it.outcome === "wrong" || it.outcome === "timeout") && "bg-bad-500",
            it.outcome === "passed" && "bg-gold-500",
            it.outcome === "pending" && (i === current ? "bg-turquoise-400" : "bg-white/15"),
          )}
        />
      ))}
    </ol>
  );
}

export function PhaseStage({
  view,
  remainingMs,
  busy,
  feedback,
  onAnswer,
  onPass,
  onClue,
}: {
  view: SoloView;
  remainingMs: number;
  busy: boolean;
  feedback: { fb: FeedbackView; stamp: number } | null;
  onAnswer: (text: string, item: number) => void;
  onPass: (item: number) => void;
  onClue: (item: number) => void;
}) {
  const prompt = view.stage.prompt;
  const fraction = view.stage.timeLimitMs > 0 ? remainingMs / view.stage.timeLimitMs : 0;
  const low = remainingMs <= 10_000;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="panel-soft flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{view.stage.tagline}</p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink-50">{view.stage.title}</h2>
          </div>
          <div
            className="text-right"
            role="timer"
            aria-label={`Tiempo restante de la prueba ${formatClock(remainingMs)}`}
          >
            <span
              className={cn("score-digits block text-4xl leading-none", low ? "text-bad-400" : "text-ink-50")}
              aria-hidden="true"
            >
              {formatClock(remainingMs)}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">
              {view.totals.phasePoints} pts · +{view.totals.bonusSeconds} s
            </span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200 ease-linear",
              low ? "bg-bad-500" : "bg-turquoise-400",
            )}
            style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
          />
        </div>
        <ItemDots items={view.stage.items} current={prompt?.index ?? null} />
      </div>
      {prompt ? <QuestionCard prompt={prompt} /> : null}
      <FeedbackBanner feedback={feedback?.fb ?? null} stamp={feedback?.stamp ?? 0} />
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-white/10 bg-night-950/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <AnswerForm
          promptKey={`${view.stageIndex}-${prompt?.index ?? "x"}`}
          disabled={!prompt || remainingMs <= 0}
          disabledReason={remainingMs <= 0 ? "Se acabó el tiempo de la prueba" : undefined}
          busy={busy}
          passLabel="Paso"
          onAnswer={(text) => prompt && onAnswer(text, prompt.index)}
          onPass={() => prompt && onPass(prompt.index)}
          extra={
            prompt?.kind === "clues" ? (
              <button
                type="button"
                className="btn btn-ghost min-h-14"
                disabled={!prompt.canRevealClue || busy}
                onClick={() => onClue(prompt.index)}
              >
                <Eye className="size-4" aria-hidden="true" />
                Otra pista
              </button>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
