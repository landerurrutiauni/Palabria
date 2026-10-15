import Link from "next/link";
import { Handshake, Home, Trophy } from "lucide-react";
import { Rosco } from "@/components/game/rosco";
import { ShareButton } from "@/components/game/share-button";
import { PhaseSolutions, RoscoSolutions } from "@/components/game/solutions";
import { cn } from "@/lib/client/cn";
import { formatDuration } from "@/lib/game/clock";
import { modeLabel } from "@/lib/game/phases";
import type { DuelPlayerView, DuelView, Seat } from "@/lib/views";

function Line({ p, winner }: { p: DuelPlayerView; winner: boolean }) {
  return (
    <div className={cn("panel flex flex-col items-center p-5 text-center", winner && "border-gold-400/60 shadow-glow-gold")}>
      <p className="flex items-center gap-2 font-display text-lg font-bold text-ink-50">
        {winner ? <Trophy className="size-5 text-gold-400" aria-label="Ganador" /> : null}
        {p.name}
        {p.isYou ? <span className="text-sm text-turquoise-300">(tú)</span> : null}
      </p>
      <p className="score-digits mt-2 text-6xl text-ok-400">{p.correct}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-300">aciertos</p>
      <dl className="mt-4 grid w-full grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-ink-400">Fallos</dt>
          <dd className="score-digits text-2xl text-bad-400">{p.wrong}</dd>
        </div>
        <div>
          <dt className="text-ink-400">Sin resolver</dt>
          <dd className="score-digits text-2xl text-ink-100">{p.open}</dd>
        </div>
        <div>
          <dt className="text-ink-400">Tiempo</dt>
          <dd className="score-digits text-2xl text-ink-100">{formatDuration(p.timeUsedMs)}</dd>
        </div>
      </dl>
      {p.status === "abandoned" ? <p className="mt-3 text-sm font-semibold text-gold-300">Abandonó la partida</p> : null}
      <div className="mt-4 w-full max-w-[16rem]">
        <Rosco letters={p.letters} label={p.isYou ? "Tu rosco final" : `Rosco final de ${p.name}`} />
      </div>
    </div>
  );
}

/** Pantalla de victoria, derrota o empate. */
export function DuelResult({ view }: { view: DuelView }) {
  const you = view.you as Seat;
  const rivalSeat: Seat = you === 1 ? 2 : 1;
  const me = view.players[you]!;
  const rival = view.players[rivalSeat]!;
  const outcome = view.result?.outcome;
  const abandoned = view.status === "abandoned";
  const title = outcome === "win" ? "¡Victoria!" : outcome === "loss" ? "Derrota" : "Empate";
  const subtitle = abandoned
    ? outcome === "win"
      ? `${rival.name} abandonó la partida.`
      : outcome === "loss"
        ? "Abandonaste la partida (o se agotó el margen de reconexión)."
        : "Ambos jugadores abandonaron."
    : outcome === "draw"
      ? "Mismos aciertos, mismos fallos y mismo tiempo."
      : "Gana quien más acierta; luego, quien menos falla; después, quien menos tiempo usa.";
  return (
    <div className="flex flex-col gap-6">
      <section className="panel stage-lights relative overflow-hidden p-6 text-center sm:p-10">
        <p className="eyebrow">Duelo 1 vs 1 · {modeLabel(view.mode)}</p>
        <h1
          className={cn(
            "mt-3 animate-pop font-display text-5xl font-extrabold sm:text-7xl",
            outcome === "win" ? "text-gold-300" : outcome === "loss" ? "text-ink-100" : "text-turquoise-300",
          )}
        >
          {outcome === "draw" ? <Handshake className="mx-auto mb-2 size-12" aria-hidden="true" /> : null}
          {title}
        </h1>
        <p className="mt-3 text-lg text-ink-200">{subtitle}</p>
        <p className="score-digits mt-6 text-5xl text-ink-50">
          {me.correct} <span className="text-ink-400">—</span> {rival.correct}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {view.result?.shareText ? <ShareButton text={view.result.shareText} title="Mi duelo en Palabría" /> : null}
          <Link href="/estadisticas" className="btn btn-ghost">
            <Trophy className="size-4" aria-hidden="true" />
            Mis estadísticas
          </Link>
          <Link href="/" className="btn btn-ghost">
            <Home className="size-4" aria-hidden="true" />
            Portada
          </Link>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        <Line p={me} winner={view.result?.winnerSeat === you} />
        <Line p={rival} winner={view.result?.winnerSeat === rivalSeat} />
      </div>
      {view.result?.you ? <RoscoSolutions letters={view.result.you.letters} title="Tus soluciones" /> : null}
      {view.result?.you ? <PhaseSolutions phases={view.result.you.phases} /> : null}
      {view.result?.rival ? (
        <details className="panel p-5 sm:p-6">
          <summary className="cursor-pointer font-display text-lg font-bold text-ink-50">Preguntas de {rival.name}</summary>
          <div className="mt-4">
            <RoscoSolutions letters={view.result.rival.letters} title={`Soluciones de ${rival.name}`} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
