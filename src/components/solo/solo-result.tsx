import Link from "next/link";
import { Flame, Swords, Trophy } from "lucide-react";
import { Rosco } from "@/components/game/rosco";
import { ShareButton } from "@/components/game/share-button";
import { PhaseSolutions, RoscoSolutions } from "@/components/game/solutions";
import { formatDuration } from "@/lib/game/clock";
import { formatChallengeDate } from "@/lib/game/daily";
import { modeLabel } from "@/lib/game/phases";
import type { LetterView, SoloResultView } from "@/lib/views";

export function SoloResult({ result, showActions = true }: { result: SoloResultView; showActions?: boolean }) {
  const letters: LetterView[] = result.letters.map((l) => ({
    letter: l.letter,
    mode: l.mode,
    state: l.status === "correct" ? "correct" : l.status === "wrong" ? "wrong" : "unplayed",
  }));
  const headline =
    result.status === "abandoned"
      ? "Programa sin terminar"
      : result.perfect
        ? "¡Rosco perfecto!"
        : result.roscoComplete
          ? "¡Rosco completado!"
          : "¡Tiempo!";
  const stats = [
    { label: "Aciertos", value: result.correct, tone: "text-ok-400" },
    { label: "Errores", value: result.wrong, tone: "text-bad-400" },
    { label: "Sin resolver", value: result.unanswered, tone: "text-ink-200" },
    {
      label: "Tiempo",
      value: formatDuration(result.mode === "rosco" ? result.roscoTimeUsedMs : result.totalTimeUsedMs),
      tone: "text-ink-50",
    },
    { label: "Acierto", value: `${result.accuracy}%`, tone: "text-turquoise-300" },
    ...(result.mode === "program"
      ? [
          { label: "Pruebas", value: `${result.phasePoints} pts`, tone: "text-violet-400" },
          { label: "Segundos ganados", value: `+${result.bonusSeconds} s`, tone: "text-gold-300" },
        ]
      : []),
  ];
  return (
    <div className="flex flex-col gap-6">
      <section className="panel stage-lights relative overflow-hidden p-6 text-center sm:p-10">
        <p className="eyebrow">
          {modeLabel(result.mode)} · {formatChallengeDate(result.date, { weekday: false })}
        </p>
        <h1 className="mt-3 font-display text-3xl font-extrabold text-ink-50 sm:text-5xl">{headline}</h1>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.25em] text-ink-300">Puntuación final</p>
        <p className="score-digits animate-pop bg-gradient-to-b from-gold-300 to-gold-500 bg-clip-text text-8xl leading-none text-transparent sm:text-9xl">
          {result.score}
        </p>
        {result.mode === "program" ? (
          <p className="mt-2 text-sm text-ink-300">
            {result.phasePoints} de las pruebas + {result.roscoPoints} del rosco
          </p>
        ) : null}
        <ul className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((s) => (
            <li key={s.label} className="panel-soft p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-300">{s.label}</p>
              <p className={`score-digits mt-1 text-3xl ${s.tone}`}>{s.value}</p>
            </li>
          ))}
          <li className="panel-soft p-3">
            <p className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink-300">
              <Flame className="size-3.5 text-gold-400" aria-hidden="true" /> Racha
            </p>
            <p className="score-digits mt-1 text-3xl text-gold-300">{result.streak.current}</p>
          </li>
        </ul>
        {showActions ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ShareButton text={result.shareText} />
            <Link href="/clasificacion" className="btn btn-ghost">
              <Trophy className="size-4" aria-hidden="true" />
              Clasificación
            </Link>
            <Link href="/duelo" className="btn btn-ghost">
              <Swords className="size-4" aria-hidden="true" />
              Desafiar a un amigo
            </Link>
          </div>
        ) : null}
        {result.status === "abandoned" ? (
          <p className="mx-auto mt-6 max-w-lg text-sm text-ink-300">
            El programa se dio por terminado porque pasaron más de 30 minutos sin continuar entre pruebas. Se guarda la
            puntuación obtenida; la racha solo cuenta con partidas completadas.
          </p>
        ) : null}
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <div className="panel p-5">
          <h2 className="font-display text-lg font-bold text-ink-50">Tu rosco final</h2>
          <div className="mx-auto mt-4 max-w-sm">
            <Rosco letters={letters} label="Rosco final">
              <div className="flex flex-col items-center">
                <span className="score-digits text-[18cqw] leading-none text-ok-400">{result.correct}</span>
                <span className="font-display text-[3cqw] uppercase tracking-[0.25em] text-ink-300">aciertos</span>
              </div>
            </Rosco>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <RoscoSolutions letters={result.letters} />
          <PhaseSolutions phases={result.phases} />
        </div>
      </div>
    </div>
  );
}
