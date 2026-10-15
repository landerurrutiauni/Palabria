import Link from "next/link";
import { ArrowRight, CalendarDays, Flame, History, Medal, Play, Sparkles, Swords, Timer, User } from "lucide-react";
import { Countdown } from "@/components/home/countdown";
import { LeaderboardLink, LeaderboardTable } from "@/components/home/leaderboard-preview";
import { Rosco } from "@/components/game/rosco";
import { AttemptBadge, type AttemptState } from "@/components/ui/status-badge";
import { roomHref } from "@/lib/client/runtime";
import type { LetterMode } from "@/lib/game/alphabet";
import { formatChallengeDate } from "@/lib/game/daily";
import { difficultyLabel, PHASE_RULES, PROGRAM_PHASES } from "@/lib/game/phases";
import type { LeaderboardView, LetterView, MeView, StatsView } from "@/lib/views";

export interface ChallengeInfo {
  date: string;
  publicId: string;
  difficulty: "facil" | "media" | "dificil";
  serverNow: number;
  nextResetAt: number;
  letters: { letter: string; mode: LetterMode }[];
}

export interface HomeData {
  challenge: ChallengeInfo;
  me: MeView | null;
  stats: StatsView | null;
  boardRosco: LeaderboardView | null;
  boardProgram: LeaderboardView | null;
}

/** Portada: desafío del día, modalidades, progreso y clasificación. */
export function HomeView({ data }: { data: HomeData }) {
  const { challenge, me, stats, boardRosco, boardProgram } = data;
  const now = challenge.serverNow;
  const date = challenge.date;
  const preview = challenge.letters;
  const letters: LetterView[] = preview.map((l) => ({ letter: l.letter, mode: l.mode, state: "pending" }));
  const containsCount = preview.filter((l) => l.mode === "contains").length;

  const solo = me?.attempts.solo;
  const duel = me?.attempts.duel;
  const soloState: AttemptState = !solo?.used
    ? "available"
    : solo.status === "in_progress"
      ? "in_progress"
      : "completed";
  const duelState: AttemptState = !duel?.used
    ? "available"
    : duel.status === "in_progress"
      ? "in_progress"
      : "completed";
  const soloHref = solo?.mode === "program" ? "/jugar/programa" : "/jugar/rosco";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* ── Cabecera del desafío ── */}
      <section className="stage-lights relative grid items-center gap-8 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-14">
        <div className="relative z-10">
          <p className="eyebrow flex items-center gap-2">
            <CalendarDays className="size-4" aria-hidden="true" />
            Desafío del día · {challenge.publicId}
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink-50 sm:text-5xl lg:text-6xl">
            Veintisiete letras.
            <br />
            <span className="bg-gradient-to-r from-turquoise-300 via-ink-50 to-gold-300 bg-clip-text text-transparent">
              Un solo intento.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-200">
            {capitalize(formatChallengeDate(date))}. Juega El Rosco del día en solitario o reta a un amigo a un duelo
            por turnos con reloj propio.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="chip">
              <Sparkles className="size-3.5 text-gold-400" aria-hidden="true" />
              Dificultad {difficultyLabel(challenge.difficulty).toLowerCase()}
            </span>
            <span className="chip">
              {27 - containsCount} «empieza por» · {containsCount} «contiene»
            </span>
            <span className="chip">
              <Timer className="size-3.5 text-turquoise-300" aria-hidden="true" />
              Nuevo desafío en <Countdown target={challenge.nextResetAt} serverNow={now} className="text-ink-50" />
            </span>
          </div>
          {me && (
            <p className="mt-5 text-sm text-ink-300">
              Juegas como <strong className="text-ink-50">{me.displayName}</strong> ·{" "}
              <Link href="/ajustes" className="font-semibold text-turquoise-300 hover:underline">
                cambiar nombre
              </Link>{" "}
              · sin registro
            </p>
          )}
        </div>
        <div className="relative mx-auto w-full max-w-[26rem]">
          <Rosco letters={letters} label="Letras del rosco de hoy" paused>
            <div className="flex flex-col items-center">
              <span className="score-digits text-[15cqw] leading-none text-ink-50">27</span>
              <span className="mt-1 font-display text-[3.2cqw] uppercase tracking-[0.3em] text-turquoise-300">
                letras
              </span>
              <span className="mt-2 text-[3cqw] text-ink-300">A · Ñ · Z</span>
            </div>
          </Rosco>
        </div>
      </section>

      {/* ── Modalidades ── */}
      <section aria-labelledby="modos" className="mt-12 grid gap-5 md:grid-cols-2">
        <h2 id="modos" className="sr-only">
          Modalidades
        </h2>
        <article className="panel flex flex-col p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-turquoise-400/15 text-turquoise-300">
                <User className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-ink-50">Juega en solitario</h3>
                <p className="text-sm text-ink-300">Un intento diario, contra el reloj</p>
              </div>
            </div>
            <AttemptBadge state={soloState} />
          </div>
          {soloState === "available" ? (
            <div className="mt-6 grid gap-3">
              <Link
                href="/jugar/programa"
                className="group panel-soft flex items-center justify-between gap-4 p-4 transition hover:border-turquoise-400/50"
              >
                <span>
                  <span className="block font-bold text-ink-50">Programa completo</span>
                  <span className="text-sm text-ink-300">
                    {PROGRAM_PHASES.length} pruebas + El Rosco · unos 8 minutos
                  </span>
                </span>
                <ArrowRight
                  className="size-5 text-turquoise-300 transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/jugar/rosco"
                className="group panel-soft flex items-center justify-between gap-4 p-4 transition hover:border-turquoise-400/50"
              >
                <span>
                  <span className="block font-bold text-ink-50">Solo El Rosco</span>
                  <span className="text-sm text-ink-300">27 letras · 3 minutos</span>
                </span>
                <ArrowRight
                  className="size-5 text-turquoise-300 transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <p className="text-xs text-ink-400">
                Ambas opciones comparten el mismo intento: al empezar una, la otra queda bloqueada hasta mañana.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              <p className="text-ink-200">
                {soloState === "in_progress"
                  ? `Tienes una partida de ${solo?.mode === "program" ? "Programa completo" : "Solo El Rosco"} en curso. El reloj sigue corriendo.`
                  : `Ya has jugado tu intento individual de hoy (${solo?.mode === "program" ? "Programa completo" : "Solo El Rosco"}).`}
              </p>
              <Link href={soloHref} className="btn btn-primary w-full sm:w-auto">
                <Play className="size-4" aria-hidden="true" />
                {soloState === "in_progress" ? "Continuar partida" : "Ver mi resultado"}
              </Link>
            </div>
          )}
        </article>

        <article className="panel flex flex-col p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-gold-400/15 text-gold-300">
                <Swords className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-ink-50">Desafía a un amigo</h3>
                <p className="text-sm text-ink-300">1 vs 1 por turnos, con enlace privado</p>
              </div>
            </div>
            <AttemptBadge state={duelState} />
          </div>
          <ul className="mt-6 space-y-2 text-sm text-ink-200">
            <li>· Cada jugador tiene su propio rosco, sus preguntas y su reloj.</li>
            <li>· Si aciertas, sigues. Si fallas o dices «Pasapalabra», tu reloj se para y arranca el del rival.</li>
            <li>· Crear la sala no gasta tu intento: se consume al empezar el duelo.</li>
          </ul>
          <div className="mt-auto pt-6">
            {duelState === "available" ? (
              duel?.openRoomCode ? (
                <Link href={roomHref(duel.openRoomCode)} className="btn btn-gold w-full sm:w-auto">
                  Volver a mi sala
                </Link>
              ) : (
                <Link href="/duelo" className="btn btn-gold w-full sm:w-auto">
                  <Swords className="size-4" aria-hidden="true" />
                  Crear sala privada
                </Link>
              )
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="text-sm text-ink-300">
                  {duelState === "in_progress" ? "Tu duelo de hoy está en marcha." : "Ya has jugado tu duelo de hoy."}
                </p>
                {duel?.roomCode && (
                  <Link href={roomHref(duel.roomCode)} className="btn btn-ghost">
                    {duelState === "in_progress" ? "Volver al duelo" : "Ver el resultado"}
                  </Link>
                )}
              </div>
            )}
          </div>
        </article>
      </section>

      {/* ── Progreso personal ── */}
      <section aria-labelledby="progreso" className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 id="progreso" className="font-display text-lg font-bold text-ink-50">
            Tu progreso
          </h2>
          <Link href="/estadisticas" className="text-sm font-semibold text-turquoise-300 hover:text-turquoise-400">
            Estadísticas e historial →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={<Flame className="size-5 text-gold-400" aria-hidden="true" />}
            label="Racha actual"
            value={me?.streak.current ?? 0}
            suffix="días"
          />
          <StatTile
            icon={<Medal className="size-5 text-turquoise-300" aria-hidden="true" />}
            label="Mejor racha"
            value={me?.streak.best ?? 0}
            suffix="días"
          />
          <StatTile
            icon={<Sparkles className="size-5 text-violet-400" aria-hidden="true" />}
            label="Mejor rosco"
            value={stats?.solo.bestScoreRosco ?? "—"}
            suffix={stats?.solo.bestScoreRosco != null ? "pts" : ""}
          />
          <StatTile
            icon={<Swords className="size-5 text-ok-400" aria-hidden="true" />}
            label="Duelos ganados"
            value={stats?.duel.wins ?? 0}
            suffix={`de ${stats?.duel.played ?? 0}`}
          />
        </div>
      </section>

      {/* ── Clasificación del día ── */}
      <section aria-labelledby="clasificacion" className="mt-10 grid gap-5 lg:grid-cols-2">
        <h2 id="clasificacion" className="sr-only">
          Clasificación del día
        </h2>
        <BoardCard title="Clasificación · Solo El Rosco" board={boardRosco} />
        <BoardCard title="Clasificación · Programa completo" board={boardProgram} />
      </section>

      {/* ── Programa ── */}
      <section aria-labelledby="programa" className="panel mt-10 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">El programa completo</p>
            <h2 id="programa" className="mt-2 font-display text-2xl font-bold text-ink-50">
              Cuatro pruebas y un rosco final
            </h2>
          </div>
          <Link href="/como-se-juega" className="btn btn-ghost">
            <History className="size-4" aria-hidden="true" />
            Cómo se juega
          </Link>
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PROGRAM_PHASES.map((kind, i) => (
            <li key={kind} className="panel-soft p-4">
              <span className="score-digits text-3xl text-violet-400">{i + 1}</span>
              <p className="mt-1 font-bold text-ink-50">{PHASE_RULES[kind].title}</p>
              <p className="mt-1 text-sm text-ink-300">{PHASE_RULES[kind].tagline}</p>
            </li>
          ))}
          <li className="panel-soft border-turquoise-400/40 p-4">
            <span className="score-digits text-3xl text-turquoise-300">5</span>
            <p className="mt-1 font-bold text-ink-50">El Rosco</p>
            <p className="mt-1 text-sm text-ink-300">Con los segundos que hayas ganado</p>
          </li>
        </ol>
      </section>
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function StatTile({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="panel-soft p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-300">
        {icon}
        {label}
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="score-digits text-4xl text-ink-50">{value}</span>
        {suffix ? <span className="text-sm text-ink-300">{suffix}</span> : null}
      </p>
    </div>
  );
}

function BoardCard({ title, board }: { title: string; board: LeaderboardView | null }) {
  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-bold text-ink-50">{title}</h3>
        <LeaderboardLink />
      </div>
      <div className="mt-4">
        {board ? (
          <LeaderboardTable board={board} />
        ) : (
          <p className="text-sm text-ink-300">La clasificación no está disponible en este momento.</p>
        )}
      </div>
    </div>
  );
}
