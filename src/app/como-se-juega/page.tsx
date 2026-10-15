import type { Metadata } from "next";
import Link from "next/link";
import { RoscoLegend } from "@/components/game/rosco";
import { DuelRules } from "@/components/duel/duel-rules";
import { timingFromEnv } from "@/lib/game/config";
import { PHASE_RULES, PROGRAM_PHASES } from "@/lib/game/phases";

export const metadata: Metadata = { title: "Cómo se juega" };

export default function RulesPage() {
  const timing = timingFromEnv();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Reglas</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink-50 sm:text-4xl">Cómo se juega a Palabría</h1>

      <section className="panel mt-8 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-ink-50">Intentos diarios</h2>
        <ul className="mt-3 space-y-2 text-ink-200">
          <li>· Cada día (00:00, hora de España) hay un desafío nuevo, igual para todo el mundo.</li>
          <li>· Tienes un intento individual (compartido entre «Solo El Rosco» y «Programa completo»).</li>
          <li>· Y, además, un duelo 1 vs 1, independiente del individual.</li>
          <li>· El servidor lleva la cuenta: cambiar la hora del dispositivo no da intentos extra.</li>
        </ul>
      </section>

      <section className="panel mt-6 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-ink-50">El Rosco</h2>
        <ul className="mt-3 space-y-2 text-ink-200">
          <li>· 27 letras del alfabeto español, de la A a la Z, incluida la Ñ.</li>
          <li>· Cada letra tiene una definición: la respuesta empieza por esa letra o la contiene.</li>
          <li>· Las tildes y mayúsculas no importan; la Ñ sí (no es lo mismo «año» que «ano»).</li>
          <li>· «Pasapalabra» deja la letra para la siguiente vuelta. Un fallo la cierra.</li>
          <li>
            · Tiempo individual: {Math.round(timing.soloRoscoMs / 1000)} s. El reloj no se detiene aunque recargues.
          </li>
          <li>· Puntos: +10 por acierto, −5 por fallo y, si resuelves todas las letras, +1 por segundo sobrante.</li>
        </ul>
        <RoscoLegend className="mt-6" />
      </section>

      <section className="panel mt-6 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-ink-50">El programa completo</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROGRAM_PHASES.map((kind, i) => (
            <li key={kind} className="panel-soft p-4">
              <p className="font-bold text-ink-50">
                {i + 1}. {PHASE_RULES[kind].title}
              </p>
              <p className="mt-1 text-sm text-ink-200">{PHASE_RULES[kind].howTo}</p>
              <p className="mt-2 text-xs text-ink-400">
                Individual: {PHASE_RULES[kind].soloItems} preguntas en {PHASE_RULES[kind].soloTimeMs / 1000} s · Duelo:{" "}
                {PHASE_RULES[kind].duelItemsPerPlayer} por jugador, {PHASE_RULES[kind].duelShotClockMs / 1000} s por
                turno
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-ink-200">
          5. <strong className="text-ink-50">El Rosco</strong>: empieza con{" "}
          {Math.round(timing.programRoscoBaseMs / 1000)} s más los segundos que hayas ganado en las pruebas.
        </p>
      </section>

      <DuelRules
        className="panel mt-6 p-6 sm:p-8"
        roscoSeconds={Math.round(timing.duelRoscoMs / 1000)}
        programRoscoSeconds={Math.round(timing.duelProgramRoscoBaseMs / 1000)}
        graceSeconds={Math.round(timing.reconnectGraceMs / 1000)}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/jugar" className="btn btn-primary">
          Jugar ahora
        </Link>
        <Link href="/duelo" className="btn btn-gold">
          Desafiar a un amigo
        </Link>
      </div>
    </div>
  );
}
