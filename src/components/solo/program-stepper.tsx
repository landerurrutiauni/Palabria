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
                done && "border-ok-500/40 bg-ok-500/10 text-ok-400",
                active && "border-turquoise-400/70 bg-turquoise-400/15 text-ink-50 shadow-glow-turquoise",
                !done && !active && "border-white/10 bg-white/5 text-ink-400",
              )}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/10 text-[0.7rem]">
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
