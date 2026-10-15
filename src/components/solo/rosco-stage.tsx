"use client";

import { AnswerForm } from "@/components/game/answer-form";
import { FeedbackBanner } from "@/components/game/feedback";
import { QuestionCard } from "@/components/game/question-card";
import { Rosco } from "@/components/game/rosco";
import { StatChips } from "@/components/game/stat-chips";
import { TimerDisplay } from "@/components/game/timer";
import { formatClock } from "@/lib/game/clock";
import { cn } from "@/lib/client/cn";
import type { FeedbackView, SoloView } from "@/lib/views";

export function RoscoStage({
  view,
  remainingMs,
  busy,
  feedback,
  onAnswer,
  onPass,
}: {
  view: SoloView;
  remainingMs: number;
  busy: boolean;
  feedback: { fb: FeedbackView; stamp: number } | null;
  onAnswer: (text: string, item: number) => void;
  onPass: (item: number) => void;
}) {
  const prompt = view.stage.prompt;
  const low = remainingMs <= 10_000;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-8">
      <div className="mx-auto w-full max-w-[19rem] sm:max-w-[24rem] lg:max-w-[34rem]">
        <Rosco letters={view.stage.letters} label="Tu rosco">
          <div
            className="flex flex-col items-center"
            role="timer"
            aria-label={`Tiempo restante ${formatClock(remainingMs)}`}
          >
            <span
              className={cn("score-digits text-[19cqw] leading-none", low ? "text-bad-400" : "text-ink-50")}
              aria-hidden="true"
            >
              {formatClock(remainingMs)}
            </span>
            <span
              className="mt-1 font-display text-[3cqw] uppercase tracking-[0.25em] text-turquoise-300"
              aria-hidden="true"
            >
              {view.totals.correct} aciertos
            </span>
          </div>
        </Rosco>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <StatChips correct={view.totals.correct} wrong={view.totals.wrong} open={view.totals.open} compact />
          <TimerDisplay
            remainingMs={remainingMs}
            totalMs={view.stage.timeLimitMs}
            running
            size="sm"
            className="hidden sm:grid lg:hidden"
          />
        </div>
        {prompt ? <QuestionCard prompt={prompt} /> : null}
        <FeedbackBanner feedback={feedback?.fb ?? null} stamp={feedback?.stamp ?? 0} />
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-white/10 bg-night-950/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <AnswerForm
            promptKey={`${view.stageIndex}-${prompt?.index ?? "x"}`}
            disabled={!prompt || remainingMs <= 0}
            disabledReason={remainingMs <= 0 ? "Se acabó el tiempo" : undefined}
            busy={busy}
            onAnswer={(text) => prompt && onAnswer(text, prompt.index)}
            onPass={() => prompt && onPass(prompt.index)}
          />
        </div>
      </div>
    </div>
  );
}
