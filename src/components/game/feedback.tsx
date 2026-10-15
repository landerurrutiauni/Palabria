import { Check, Clock, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/client/cn";
import type { FeedbackView } from "@/lib/views";

/** Indicación inmediata tras cada respuesta (anunciada a lectores de pantalla). */
export function FeedbackBanner({ feedback, stamp, className }: { feedback: FeedbackView | null; stamp: number; className?: string }) {
  return (
    <div aria-live="polite" aria-atomic="true" className={cn("min-h-12", className)}>
      {feedback && feedback.outcome !== "clue" ? (
        <div
          key={stamp}
          className={cn(
            "flex animate-rise items-center gap-3 rounded-2xl border px-4 py-2.5 text-base font-semibold",
            feedback.outcome === "correct" && "border-ok-500/50 bg-ok-500/15 text-ok-400",
            feedback.outcome === "wrong" && "animate-shake border-bad-500/50 bg-bad-500/15 text-bad-400",
            feedback.outcome === "passed" && "border-gold-400/50 bg-gold-400/10 text-gold-300",
            feedback.outcome === "timeout" && "border-white/20 bg-white/5 text-ink-200",
          )}
        >
          {feedback.outcome === "correct" && <Check className="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />}
          {feedback.outcome === "wrong" && <X className="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />}
          {feedback.outcome === "passed" && <RotateCcw className="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />}
          {feedback.outcome === "timeout" && <Clock className="size-5 shrink-0" aria-hidden="true" />}
          <span>
            {feedback.outcome === "correct" && (
              <>¡Correcto!{feedback.points > 0 ? ` +${feedback.points} puntos` : ""}</>
            )}
            {feedback.outcome === "wrong" && (
              <>
                Incorrecto{feedback.answer ? (
                  <>
                    . Era <strong className="text-ink-50">«{feedback.answer}»</strong>
                  </>
                ) : null}
              </>
            )}
            {feedback.outcome === "passed" && (feedback.stageKind === "rosco" ? "Pasapalabra: volverás a esta letra." : "Pregunta pasada.")}
            {feedback.outcome === "timeout" && (
              <>
                Se acabó el tiempo{feedback.answer ? (
                  <>
                    . Era <strong className="text-ink-50">«{feedback.answer}»</strong>
                  </>
                ) : null}
              </>
            )}
            {feedback.outcome === "passed" && feedback.answer && feedback.stageKind !== "rosco" ? (
              <>
                {" "}
                Era <strong className="text-ink-50">«{feedback.answer}»</strong>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
