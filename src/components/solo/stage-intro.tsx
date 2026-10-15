import { Play } from "lucide-react";
import { formatClock } from "@/lib/game/clock";
import type { SoloView } from "@/lib/views";

/** Entreacto entre pruebas: el reloj está detenido hasta que el jugador continúa. */
export function StageIntro({ view, busy, onStart }: { view: SoloView; busy: boolean; onStart: () => void }) {
  const isRosco = view.stage.kind === "rosco";
  return (
    <section className="panel stage-lights relative mx-auto max-w-2xl overflow-hidden p-6 text-center sm:p-10">
      <p className="eyebrow">
        Prueba {view.stageIndex + 1} de {view.stages.length}
      </p>
      <h2 className="mt-3 font-display text-3xl font-extrabold text-ink-50 sm:text-4xl">{view.stage.title}</h2>
      <p className="mt-2 text-lg text-turquoise-300">{view.stage.tagline}</p>
      <p className="mx-auto mt-5 max-w-lg text-ink-200">{view.stage.howTo}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <span className="chip">Llevas {view.totals.phasePoints} puntos</span>
        {isRosco && view.upcomingRoscoMs !== null ? (
          <span className="chip text-gold-300">
            Tu rosco: {formatClock(view.upcomingRoscoMs)} ({view.totals.bonusSeconds} s ganados)
          </span>
        ) : (
          <span className="chip">{formatClock(view.stage.timeLimitMs)} para esta prueba</span>
        )}
      </div>
      <button
        type="button"
        className="btn btn-primary mt-8 min-h-14 px-8 text-lg"
        onClick={onStart}
        disabled={busy}
        autoFocus
      >
        <Play className="size-5" aria-hidden="true" />
        {busy ? "Preparando…" : "Empezar prueba"}
      </button>
      <p className="mt-4 text-xs text-ink-400">El reloj está detenido hasta que pulses «Empezar prueba».</p>
    </section>
  );
}
