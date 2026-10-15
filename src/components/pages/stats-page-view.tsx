import type { StatsView } from "@/lib/views";
import Link from "next/link";
import { Flame, Medal, Swords, Target, Timer, Trophy } from "lucide-react";
import { HistoryList } from "@/components/stats/history-list";
import { formatDuration } from "@/lib/game/clock";

export function StatsPageView({ stats }: { stats: StatsView }) {
  const solo = [
    { label: "Partidas jugadas", value: stats.solo.played },
    { label: "Partidas completadas", value: stats.solo.completed },
    { label: "Aciertos", value: stats.solo.correct },
    { label: "Errores", value: stats.solo.wrong },
    { label: "% de acierto", value: `${stats.solo.accuracy}%` },
    { label: "Roscos completados", value: stats.solo.roscosCompleted },
    { label: "Roscos perfectos", value: stats.solo.perfectRoscos },
    { label: "Mejor puntuación · Rosco", value: stats.solo.bestScoreRosco ?? "—" },
    { label: "Mejor puntuación · Programa", value: stats.solo.bestScoreProgram ?? "—" },
    {
      label: "Mejor tiempo (rosco resuelto)",
      value: stats.solo.bestTimeMs ? formatDuration(stats.solo.bestTimeMs) : "—",
    },
  ];
  const duel = [
    { label: "Duelos jugados", value: stats.duel.played },
    { label: "Victorias", value: stats.duel.wins },
    { label: "Derrotas", value: stats.duel.losses },
    { label: "Empates", value: stats.duel.draws },
    { label: "Aciertos", value: stats.duel.correct },
    { label: "% de acierto", value: `${stats.duel.accuracy}%` },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Sin cuentas · guardado en este navegador</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink-50 sm:text-4xl">Tus estadísticas</h1>
      <p className="mt-2 max-w-2xl text-ink-300">
        Calculadas en el servidor a partir de tus resultados verificados. Están ligadas a tu identidad anónima: si
        borras las cookies o cambias de navegador empezarás de cero.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Highlight
          icon={<Flame className="size-6 text-gold-400" />}
          label="Racha actual"
          value={`${stats.streak.current}`}
          note="días seguidos completando el desafío individual"
        />
        <Highlight
          icon={<Medal className="size-6 text-turquoise-300" />}
          label="Mejor racha"
          value={`${stats.streak.best}`}
          note="días"
        />
        <Highlight
          icon={<Trophy className="size-6 text-ok-400" />}
          label="Duelos ganados"
          value={`${stats.duel.wins}`}
          note={`de ${stats.duel.played} jugados`}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <StatGroup title="Modo individual" icon={<Target className="size-5" />} items={solo} />
        <StatGroup title="Modo 1 vs 1" icon={<Swords className="size-5" />} items={duel} />
      </div>

      <section className="mt-10" aria-labelledby="historial">
        <div className="flex items-end justify-between gap-3">
          <h2 id="historial" className="font-display text-xl font-bold text-ink-50">
            Historial por fecha
          </h2>
          <Link href="/historial" className="text-sm font-semibold text-turquoise-300 hover:underline">
            Ver todo →
          </Link>
        </div>
        <HistoryList entries={stats.history.slice(0, 10)} className="mt-4" />
      </section>
      <p className="mt-6 flex items-center gap-2 text-xs text-ink-400">
        <Timer className="size-3.5" aria-hidden="true" />
        La racha suma un día cada vez que completas tu desafío individual (Rosco o programa) y se rompe si un día no lo
        haces.
      </p>
    </div>
  );
}

function Highlight({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-300">
        <span aria-hidden="true">{icon}</span>
        {label}
      </div>
      <p className="score-digits mt-2 text-6xl text-ink-50">{value}</p>
      <p className="text-sm text-ink-300">{note}</p>
    </div>
  );
}

function StatGroup({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { label: string; value: string | number }[];
}) {
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink-50">
        <span className="text-turquoise-300" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {items.map((it) => (
          <div key={it.label} className="panel-soft p-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-300">{it.label}</dt>
            <dd className="score-digits mt-1 text-3xl text-ink-50">{it.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
