import { DUEL_RULES_TEXT } from "@/lib/game/ranking";

/** Reglas exactas del duelo, comunicadas antes de jugar. */
export function DuelRules({
  roscoSeconds,
  programRoscoSeconds,
  graceSeconds,
  mode,
  className = "panel p-6",
}: {
  roscoSeconds: number;
  programRoscoSeconds: number;
  graceSeconds: number;
  mode?: "rosco" | "program";
  className?: string;
}) {
  return (
    <aside className={className} aria-labelledby="reglas-duelo">
      <h2 id="reglas-duelo" className="font-display text-lg font-bold text-ink-900">
        Reglas del duelo
      </h2>
      <h3 className="mt-4 text-sm font-bold text-cobalt-600">Turnos y relojes</h3>
      <ul className="mt-2 space-y-2 text-sm text-ink-700 list-disc pl-5 marker:text-cobalt-600">
        <li>
          Solo hay un turno activo. Cada jugador tiene su propio reloj
          {mode === "program"
            ? ` (El Rosco final: ${programRoscoSeconds} s + los segundos ganados).`
            : mode === "rosco"
              ? ` (${roscoSeconds} s cada uno).`
              : ` (${roscoSeconds} s en «Solo El Rosco»).`}
        </li>
        <li>Acierto: sigues jugando y tu reloj sigue corriendo.</li>
        <li>Fallo o «Palabria»: tu reloj se detiene al instante y arranca el de tu rival desde lo que le quedaba.</li>
        <li>Si a tu rival se le acaba el tiempo o termina su rosco, sigues tú hasta acabar el tuyo.</li>
        <li>
          Programa completo: las pruebas se juegan por turnos alternos (una pregunta cada uno) y lo que aciertas suma
          segundos a tu rosco final ({programRoscoSeconds} s de base). Empieza El Rosco quien tenga menos tiempo.
        </li>
      </ul>
      <h3 className="mt-5 text-sm font-bold text-cobalt-600">Quién gana</h3>
      <ol className="mt-2 space-y-1.5 text-sm text-ink-700">
        {DUEL_RULES_TEXT.map((rule, i) => (
          <li key={rule}>
            {i + 1}. {rule}
          </li>
        ))}
      </ol>
      <h3 className="mt-5 text-sm font-bold text-cobalt-600">Conexión</h3>
      <p className="mt-2 text-sm text-ink-700">
        Si te desconectas, tu reloj sigue corriendo en tu turno. Si no vuelves en {graceSeconds} s mientras es tu turno,
        se considera abandono. Recargar la página no reinicia nada: vuelves al mismo punto.
      </p>
    </aside>
  );
}
