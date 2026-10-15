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
    { label: "Aciertos", value: correct, icon: Check, tone: "text-ok-700 border-ok-600/40 bg-ok-50" },
    { label: "Fallos", value: wrong, icon: X, tone: "text-bad-700 border-bad-600/40 bg-bad-50" },
    ...(passed !== undefined
      ? [
          {
            label: "Pasadas",
            value: passed,
            icon: RotateCcw,
            tone: "text-saffron-700 border-saffron-500/40 bg-saffron-400/15",
          },
        ]
      : []),
    { label: "Sin resolver", value: open, icon: CircleDashed, tone: "text-ink-700 border-glaze-300 bg-ink-900/[0.04]" },
  ];
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Marcador">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <li
          key={label}
          className={cn("flex items-center gap-2 rounded-lg border px-3", compact ? "h-9" : "h-11", tone)}
          aria-label={`${label}: ${value}`}
        >
          <Icon className="size-4" strokeWidth={3} aria-hidden="true" />
          <span className={cn("score-digits", compact ? "text-xl" : "text-2xl")} aria-hidden="true">
            {value}
          </span>
          {!compact && (
            <span className="hidden text-xs font-semibold opacity-80 sm:inline" aria-hidden="true">
              {label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
