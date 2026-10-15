import { Check, Clock, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/client/cn";
import type { FeedbackView } from "@/lib/views";

/** Indicación inmediata tras cada respuesta (anunciada a lectores de pantalla). */
export function FeedbackBanner({
  feedback,
  stamp,
  className,
}: {
  feedback: FeedbackView | null;
  stamp: number;
  className?: string;
}) {
  return (
    <div aria-live="polite" aria-atomic="true" className={cn("min-h-12", className)}>
      {feedback && feedback.outcome !== "clue" ? (
        <div
          key={stamp}
          className={cn(
            "flex animate-rise items-center gap-3 rounded-lg border px-4 py-2.5 text-base font-semibold",
            feedback.outcome === "correct" && "border-ok-600/50 bg-ok-50 text-ok-700",
            feedback.outcome === "wrong" && "animate-shake border-bad-600/50 bg-bad-50 text-bad-700",
            feedback.outcome === "passed" && "border-saffron-500/50 bg-saffron-400/15 text-saffron-700",
            feedback.outcome === "timeout" && "border-glaze-300 bg-ink-900/[0.04] text-ink-700",
          )}
        >
          {feedback.outcome === "correct" && <Check className="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />}
          {feedback.outcome === "wrong" && <X className="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />}
          {feedback.outcome === "passed" && (
            <RotateCcw className="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />
          )}
          {feedback.outcome === "timeout" && <Clock className="size-5 shrink-0" aria-hidden="true" />}
          <span>
            {feedback.outcome === "correct" && (
              <>¡Correcto!{feedback.points > 0 ? ` +${feedback.points} puntos` : ""}</>
            )}
            {feedback.outcome === "wrong" && (
              <>
                Incorrecto
                {feedback.answer ? (
                  <>
                    . Era <strong className="text-ink-900">«{feedback.answer}»</strong>
                  </>
                ) : null}
              </>
            )}
            {feedback.outcome === "passed" &&
              (feedback.stageKind === "rosco" ? "Pasapalabra: volverás a esta letra." : "Pregunta pasada.")}
            {feedback.outcome === "timeout" && (
              <>
                Se acabó el tiempo
                {feedback.answer ? (
                  <>
                    . Era <strong className="text-ink-900">«{feedback.answer}»</strong>
                  </>
                ) : null}
              </>
            )}
            {feedback.outcome === "passed" && feedback.answer && feedback.stageKind !== "rosco" ? (
              <>
                {" "}
                Era <strong className="text-ink-900">«{feedback.answer}»</strong>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
