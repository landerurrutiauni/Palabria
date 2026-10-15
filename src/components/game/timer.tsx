import { Pause } from "lucide-react";
import { formatClock } from "@/lib/game/clock";
import { cn } from "@/lib/client/cn";

/**
 * Marcador de tiempo con anillo de progreso. Solo representa el tiempo que
 * calcula el servidor; nunca decide nada.
 */
export function TimerDisplay({
  remainingMs,
  totalMs,
  running,
  label = "Tiempo",
  size = "md",
  className,
}: {
  remainingMs: number;
  totalMs: number;
  running: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const low = running && remainingMs <= 10_000;
  const r = 44;
  const c = 2 * Math.PI * r;
  const dims = size === "lg" ? "size-36 sm:size-40" : size === "sm" ? "size-20" : "size-28";
  const digits = size === "lg" ? "text-5xl sm:text-6xl" : size === "sm" ? "text-2xl" : "text-4xl";
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center", dims, className)}
      role="timer"
      aria-label={`${label}: ${formatClock(remainingMs)}${running ? "" : ", detenido"}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="#ffffff" stroke="#dfe5ee" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={low ? "#a8323e" : running ? "#1d3fa6" : "#a9b5c6"}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 220ms linear, stroke 200ms ease" }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <span
          className={cn(
            "score-digits",
            digits,
            low ? "text-bad-700" : running ? "text-ink-900" : "text-ink-600",
            low && "animate-pulse",
          )}
          aria-hidden="true"
        >
          {formatClock(remainingMs)}
        </span>
        <span className="mt-1 flex items-center gap-1 text-[0.7rem] font-semibold text-ink-600">
          {!running && size === "lg" && <Pause className="size-3" aria-hidden="true" />}
          {running ? label : "Detenido"}
        </span>
      </div>
    </div>
  );
}
