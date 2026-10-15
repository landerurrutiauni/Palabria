import { Check, Minus, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import type { LetterVisualState } from "@/lib/game/rosco";
import { cn } from "@/lib/client/cn";
import type { LetterView } from "@/lib/views";

const STATE_LABEL: Record<LetterVisualState, string> = {
  pending: "pendiente",
  active: "letra actual",
  correct: "acertada",
  wrong: "fallada",
  passed: "pasada, pendiente de recuperar",
  unplayed: "sin responder",
};

function Badge({ state }: { state: LetterVisualState }) {
  if (state === "pending" || state === "active") return null;
  const Icon = state === "correct" ? Check : state === "wrong" ? X : state === "passed" ? RotateCcw : Minus;
  return (
    <span className="badge" aria-hidden="true">
      <Icon strokeWidth={3.5} />
    </span>
  );
}

const RADIUS = 42.5; // % del contenedor

/**
 * El Rosco: 27 letras en círculo. Cada estado se distingue por color, forma
 * del borde (continuo / discontinuo) e icono, no solo por color.
 */
export function Rosco({
  letters,
  label,
  paused = false,
  className,
  children,
}: {
  letters: LetterView[];
  label: string;
  paused?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const step = 360 / letters.length;
  return (
    <div className={cn("rosco", className)} data-paused={paused ? "true" : "false"}>
      <div className="rosco-ring" aria-hidden="true" />
      <ol aria-label={label} className="absolute inset-0 m-0 list-none p-0">
        {letters.map((l, i) => {
          const angle = ((-90 + i * step) * Math.PI) / 180;
          return (
            <li
              key={l.letter + i}
              className="rosco-letter"
              data-state={l.state}
              style={{ left: `${50 + RADIUS * Math.cos(angle)}%`, top: `${50 + RADIUS * Math.sin(angle)}%` }}
              aria-label={`${l.letter}: ${STATE_LABEL[l.state]}`}
              aria-current={l.state === "active" ? "step" : undefined}
            >
              <span aria-hidden="true">{l.letter}</span>
              <Badge state={l.state} />
            </li>
          );
        })}
      </ol>
      {children ? <div className="rosco-center">{children}</div> : null}
    </div>
  );
}

/** Leyenda de estados del rosco para la explicación de reglas. */
export function RoscoLegend({ className }: { className?: string }) {
  const items: { state: LetterVisualState; text: string }[] = [
    { state: "active", text: "Letra activa" },
    { state: "correct", text: "Acertada" },
    { state: "wrong", text: "Fallada" },
    { state: "passed", text: "Pasapalabra (vuelve luego)" },
    { state: "pending", text: "Pendiente" },
    { state: "unplayed", text: "Sin responder al final" },
  ];
  return (
    <ul className={cn("grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-ink-700 sm:grid-cols-3", className)}>
      {items.map((it) => (
        <li key={it.state} className="flex items-center gap-2.5">
          <span className="rosco relative !w-9 shrink-0" style={{ containerType: "inline-size" }} aria-hidden="true">
            <span
              className="rosco-letter"
              data-state={it.state}
              style={{ left: "50%", top: "50%", ["--size" as string]: "84cqw", fontSize: "38cqw", animation: "none" }}
            >
              A
            </span>
          </span>
          {it.text}
        </li>
      ))}
    </ul>
  );
}
