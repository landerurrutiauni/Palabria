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
  const digits = size === "lg" ? "text-4xl sm:text-5xl" : size === "sm" ? "text-xl" : "text-[1.7rem]";
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center", dims, className)}
      role="timer"
      aria-label={`${label}: ${formatClock(remainingMs)}${running ? "" : ", detenido"}`}
    >
      {/* Reloj del concurso: bola naranja (en marcha), azul (detenido) o roja (últimos segundos). */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <defs>
          <radialGradient id="clock-run" cx="34%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#ffc07a" />
            <stop offset="42%" stopColor="#ff7a1a" />
            <stop offset="100%" stopColor="#d9480a" />
          </radialGradient>
          <radialGradient id="clock-stop" cx="34%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#8cc4ff" />
            <stop offset="40%" stopColor="#2f7df0" />
            <stop offset="100%" stopColor="#0a46b8" />
          </radialGradient>
          <radialGradient id="clock-low" cx="34%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#ff9ca0" />
            <stop offset="42%" stopColor="#ef3b44" />
            <stop offset="100%" stopColor="#b3141f" />
          </radialGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="41"
          fill={low ? "url(#clock-low)" : running ? "url(#clock-run)" : "url(#clock-stop)"}
        />
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 220ms linear" }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <span
          className={cn(
            "score-digits",
            digits,
            "text-white [text-shadow:0_2px_0_rgb(0_0_0/0.3)]",
            low && "animate-pulse",
          )}
          aria-hidden="true"
        >
          {formatClock(remainingMs)}
        </span>
        <span className="mt-1 flex items-center gap-1 text-[0.7rem] font-extrabold text-white/90">
          {!running && size === "lg" && <Pause className="size-3" aria-hidden="true" />}
          {running ? label : "Detenido"}
        </span>
      </div>
    </div>
  );
}
