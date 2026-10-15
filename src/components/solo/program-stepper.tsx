import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/client/cn";
import type { StageSummaryView } from "@/lib/views";

/** Progreso entre las fases del programa completo. */
export function ProgramStepper({ stages, current }: { stages: StageSummaryView[]; current: number }) {
  if (stages.length <= 1) return null;
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Fases del programa">
      {stages.map((s, i) => {
        const done = s.status === "done";
        const active = i === current && !done;
        return (
          <li
            key={s.kind}
            className="flex min-w-0 flex-1 items-center gap-1.5"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border px-3 text-xs font-semibold",
                done && "border-ok-600/40 bg-ok-50 text-ok-700",
                active && "border-cobalt-600/70 bg-cobalt-600/10 text-ink-900 shadow-glow-turn",
                !done && !active && "border-glaze-200 bg-ink-900/[0.04] text-ink-500",
              )}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink-900/[0.07] text-[0.7rem]">
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                ) : i > current ? (
                  <Lock className="size-3" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="truncate">{s.title}</span>
              {done && s.kind !== "rosco" ? (
                <span className="score-digits ml-auto shrink-0 text-sm">{s.points}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
