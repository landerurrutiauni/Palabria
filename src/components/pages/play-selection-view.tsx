import type { TimingConfig } from "@/lib/game/config";
import type { MeView } from "@/lib/views";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, ListOrdered } from "lucide-react";
import { AttemptBadge } from "@/components/ui/status-badge";
import { modeLabel, PHASE_RULES, PROGRAM_PHASES } from "@/lib/game/phases";

export function PlaySelectionView({ me, timing }: { me: MeView; timing: TimingConfig }) {
  const solo = me.attempts.solo;
  const state = !solo.used ? "available" : solo.status === "in_progress" ? "in_progress" : "completed";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Modo individual</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-50 sm:text-4xl">Elige cómo jugar hoy</h1>
          <p className="mt-2 max-w-2xl text-ink-200">
            Tienes un único intento individual al día. El programa completo y El Rosco lo comparten: elige bien.
          </p>
        </div>
        <AttemptBadge state={state} />
      </div>

      {solo.used ? (
        <div className="panel mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-8 shrink-0 text-ok-400" aria-hidden="true" />
            <p className="text-ink-200">
              {state === "in_progress" ? "Tienes en marcha" : "Hoy ya has jugado"}{" "}
              <strong className="text-ink-50">{modeLabel(solo.mode ?? "rosco")}</strong>.{" "}
              {state === "in_progress"
                ? "Termina tu partida: el reloj sigue corriendo."
                : "Vuelve mañana para el nuevo desafío."}
            </p>
          </div>
          <Link
            href={solo.mode === "program" ? "/jugar/programa" : "/jugar/rosco"}
            className="btn btn-primary shrink-0"
          >
            {state === "in_progress" ? "Continuar" : "Ver resultado"}
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <ModeCard
          href="/jugar/programa"
          disabled={solo.used}
          title="Programa completo"
          subtitle={`${PROGRAM_PHASES.length} pruebas + El Rosco`}
          icon={<ListOrdered className="size-6" aria-hidden="true" />}
          points={[
            ...PROGRAM_PHASES.map((k) => `${PHASE_RULES[k].title}: ${PHASE_RULES[k].tagline.toLowerCase()}`),
            `El Rosco: ${Math.round(timing.programRoscoBaseMs / 1000)} s + los segundos ganados`,
          ]}
        />
        <ModeCard
          href="/jugar/rosco"
          disabled={solo.used}
          title="Solo El Rosco"
          subtitle="27 letras, de la A a la Z"
          icon={<Clock3 className="size-6" aria-hidden="true" />}
          points={[
            `${Math.round(timing.soloRoscoMs / 1000)} segundos de reloj continuo`,
            "Pasapalabra para dejar letras para la siguiente vuelta",
            "Soluciones y puntuación al terminar",
          ]}
        />
      </div>
    </div>
  );
}

function ModeCard({
  href,
  disabled,
  title,
  subtitle,
  icon,
  points,
}: {
  href: string;
  disabled: boolean;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  points: string[];
}) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-turquoise-400/15 text-turquoise-300">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-xl font-bold text-ink-50">{title}</h2>
          <p className="text-sm text-ink-300">{subtitle}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-ink-200">
        {points.map((p) => (
          <li key={p}>· {p}</li>
        ))}
      </ul>
      <span className="mt-6 inline-flex items-center gap-2 font-semibold text-turquoise-300">
        {disabled ? "No disponible hasta mañana" : "Ver reglas y empezar"}
        {!disabled && <ArrowRight className="size-4" aria-hidden="true" />}
      </span>
    </>
  );
  if (disabled) {
    return (
      <div className="panel p-6 opacity-60" aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className="panel block p-6 transition hover:-translate-y-0.5 hover:border-turquoise-400/50">
      {body}
    </Link>
  );
}
