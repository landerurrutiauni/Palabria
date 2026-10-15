import { CheckCircle2, CircleDot, Hourglass } from "lucide-react";
import { cn } from "@/lib/client/cn";

export type AttemptState = "available" | "in_progress" | "completed";

export function AttemptBadge({ state, className }: { state: AttemptState; className?: string }) {
  const map = {
    available: {
      text: "Disponible",
      icon: CircleDot,
      tone: "border-cobalt-600/50 bg-cobalt-600/[0.07] text-cobalt-600",
    },
    in_progress: {
      text: "En curso",
      icon: Hourglass,
      tone: "border-saffron-500/50 bg-saffron-400/15 text-saffron-700",
    },
    completed: { text: "Completado hoy", icon: CheckCircle2, tone: "border-ok-600/40 bg-ok-50 text-ok-700" },
  }[state];
  const Icon = map.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
        map.tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {map.text}
    </span>
  );
}
