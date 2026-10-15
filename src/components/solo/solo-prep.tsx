import { Clock3, Keyboard, Play, RotateCcw } from "lucide-react";
import { RoscoLegend } from "@/components/game/rosco";
import { PHASE_RULES, PROGRAM_PHASES, type GameMode } from "@/lib/game/phases";

/** Preparación y explicación de reglas antes de gastar el intento. */
export function SoloPrep({
  mode,
  roscoSeconds,
  programRoscoSeconds,
  busy,
  onStart,
}: {
  mode: GameMode;
  roscoSeconds: number;
  programRoscoSeconds: number;
  busy: boolean;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="panel p-6 sm:p-8">
        <p className="eyebrow">{mode === "rosco" ? "Solo El Rosco" : "Programa completo"}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
          {mode === "rosco" ? "27 letras contra el reloj" : "Cuatro pruebas y El Rosco final"}
        </h1>
        {mode === "rosco" ? (
          <ul className="mt-6 space-y-4 text-ink-700">
            <Rule icon={<Clock3 className="size-5" />} title={`${roscoSeconds} segundos en total`}>
              El reloj empieza al pulsar «Empezar» y no se detiene, aunque recargues o cierres la página.
            </Rule>
            <Rule icon={<Keyboard className="size-5" />} title="Escribe y pulsa Enter">
              Las tildes y las mayúsculas no importan, pero la Ñ sí: «año» no es «ano».
            </Rule>
            <Rule icon={<RotateCcw className="size-5" />} title="«Palabria» para dejarla para luego">
              Las letras pasadas vuelven en la siguiente vuelta. Un fallo cierra la letra y sigues con la siguiente.
            </Rule>
          </ul>
        ) : (
          <ol className="mt-6 space-y-3">
            {PROGRAM_PHASES.map((kind, i) => (
              <li key={kind} className="panel-soft flex gap-4 p-4">
                <span className="score-digits text-3xl text-cobalt-500">{i + 1}</span>
                <div>
                  <p className="font-bold text-ink-900">
                    {PHASE_RULES[kind].title}{" "}
                    <span className="text-sm font-normal text-ink-600">
                      , {PHASE_RULES[kind].soloItems} preguntas de {PHASE_RULES[kind].soloTimeMs / 1000} s
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-ink-700">{PHASE_RULES[kind].howTo}</p>
                </div>
              </li>
            ))}
            <li className="panel-soft flex gap-4 border-cobalt-600/40 p-4">
              <span className="score-digits text-3xl text-cobalt-600">5</span>
              <div>
                <p className="font-bold text-ink-900">El Rosco</p>
                <p className="mt-1 text-sm text-ink-700">
                  Empieza con {programRoscoSeconds} segundos más los que hayas ganado en las pruebas. Entre prueba y
                  prueba el reloj se detiene: tú decides cuándo seguir (máximo 30 minutos).
                </p>
              </div>
            </li>
          </ol>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" className="btn btn-primary min-h-14 px-8 text-lg" onClick={onStart} disabled={busy}>
            <Play className="size-5" aria-hidden="true" />
            {busy ? "Preparando…" : "¡Empezar!"}
          </button>
          <p className="text-sm text-ink-600">
            Al empezar se gasta tu intento individual de hoy (compartido entre El Rosco y el programa completo).
          </p>
        </div>
      </section>
      <aside className="panel p-6">
        <h2 className="font-display text-lg font-bold text-ink-900">Puntuación</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-700">
          <li>· Rosco: +10 por acierto, −5 por fallo (nunca por debajo de 0).</li>
          <li>· Si no te queda ninguna letra sin resolver, +1 punto por cada segundo sobrante.</li>
          {mode === "program" ? <li>· Las pruebas suman puntos y segundos extra para El Rosco.</li> : null}
          <li>· La racha crece cada día que completas tu desafío individual.</li>
        </ul>
        <h2 className="mt-6 font-display text-lg font-bold text-ink-900">Estados del rosco</h2>
        <RoscoLegend className="mt-4 !grid-cols-1 sm:!grid-cols-2 lg:!grid-cols-1" />
      </aside>
    </div>
  );
}

function Rule({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-cobalt-600/10 text-cobalt-600"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div>
        <p className="font-semibold text-ink-900">{title}</p>
        <p className="mt-0.5 text-sm">{children}</p>
      </div>
    </li>
  );
}
