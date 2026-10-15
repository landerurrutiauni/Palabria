import { Check, CircleDashed, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/client/cn";

export function StatChips({
  correct,
  wrong,
  passed,
  open,
  compact = false,
  className,
}: {
  correct: number;
  wrong: number;
  passed?: number;
  open: number;
  compact?: boolean;
  className?: string;
}) {
  const items = [
    { label: "Aciertos", value: correct, icon: Check, tone: "text-ok-400 border-ok-500/40 bg-ok-500/10" },
    { label: "Fallos", value: wrong, icon: X, tone: "text-bad-400 border-bad-500/40 bg-bad-500/10" },
    ...(passed !== undefined
      ? [{ label: "Pasadas", value: passed, icon: RotateCcw, tone: "text-gold-300 border-gold-400/40 bg-gold-400/10" }]
      : []),
    { label: "Sin resolver", value: open, icon: CircleDashed, tone: "text-ink-200 border-white/15 bg-white/5" },
  ];
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Marcador">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <li
          key={label}
          className={cn("flex items-center gap-2 rounded-2xl border px-3", compact ? "h-9" : "h-11", tone)}
          aria-label={`${label}: ${value}`}
        >
          <Icon className="size-4" strokeWidth={3} aria-hidden="true" />
          <span className={cn("score-digits", compact ? "text-xl" : "text-2xl")} aria-hidden="true">
            {value}
          </span>
          {!compact && (
            <span className="hidden text-xs font-semibold uppercase tracking-wider opacity-80 sm:inline" aria-hidden="true">
              {label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
