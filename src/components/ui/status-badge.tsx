import { CheckCircle2, CircleDot, Hourglass } from "lucide-react";
import { cn } from "@/lib/client/cn";

export type AttemptState = "available" | "in_progress" | "completed";

export function AttemptBadge({ state, className }: { state: AttemptState; className?: string }) {
  const map = {
    available: { text: "Disponible", icon: CircleDot, tone: "border-turquoise-400/50 bg-turquoise-400/10 text-turquoise-300" },
    in_progress: { text: "En curso", icon: Hourglass, tone: "border-gold-400/50 bg-gold-400/10 text-gold-300" },
    completed: { text: "Completado hoy", icon: CheckCircle2, tone: "border-ok-500/40 bg-ok-500/10 text-ok-400" },
  }[state];
  const Icon = map.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider", map.tone, className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {map.text}
    </span>
  );
}
