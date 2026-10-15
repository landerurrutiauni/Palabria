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
      {/* ── Cabecera del desafío: placa de calle + rosco del día ── */}
      <section className="grid items-center gap-10 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pt-14">
        <div className="plaque px-6 py-7 sm:px-10 sm:py-10">
          <p className="eyebrow flex items-center gap-2">
            <CalendarDays className="size-4" aria-hidden="true" />
            Desafío {challenge.publicId}
          </p>
          <h1 className="mt-3 font-display text-[2.6rem] font-bold leading-[0.98] tracking-[-0.015em] text-cobalt-700 sm:text-6xl">
            Veintisiete letras, un solo intento.
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink-700">
            {capitalize(formatChallengeDate(date))}. El mismo rosco para todo el mundo: juégalo en solitario o reta a
            alguien a un duelo por turnos.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href={soloState === "available" ? "/jugar" : soloHref}
              className="btn btn-primary min-h-[3.25rem] px-6 text-[1.05rem]"
            >
              <Play className="size-4" aria-hidden="true" />
              {soloState === "available"
                ? "Jugar el rosco de hoy"
                : soloState === "in_progress"
                  ? "Continuar partida"
                  : "Ver mi resultado"}
            </Link>
            <Link href="/duelo" className="btn btn-ghost min-h-[3.25rem] px-6 text-[1.05rem]">
              <Swords className="size-4" aria-hidden="true" />
              Retar a alguien
            </Link>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-glaze-300 bg-glaze-300 text-sm">
            <div className="bg-glaze-50 px-3 py-2.5">
              <dt className="text-ink-600">Dificultad</dt>
              <dd className="font-semibold text-ink-900">{difficultyLabel(challenge.difficulty)}</dd>
            </div>
            <div className="bg-glaze-50 px-3 py-2.5">
              <dt className="text-ink-600">«Contiene»</dt>
              <dd className="font-semibold text-ink-900">
                {containsCount} {containsCount === 1 ? "letra" : "letras"}
              </dd>
            </div>
            <div className="bg-glaze-50 px-3 py-2.5">
              <dt className="flex items-center gap-1 text-ink-600">
                <Timer className="size-3.5" aria-hidden="true" />
                Nuevo en
              </dt>
              <dd className="font-semibold text-ink-900">
                <Countdown target={challenge.nextResetAt} serverNow={now} className="tabular" />
              </dd>
            </div>
          </dl>
          {me && (
            <p className="mt-5 text-sm text-ink-600">
              Juegas como <strong className="text-ink-900">{me.displayName}</strong>, sin registro.{" "}
              <Link href="/ajustes" className="font-semibold text-cobalt-600 underline-offset-2 hover:underline">
                Cambiar nombre
              </Link>
            </p>
          )}
        </div>
        <div className="relative mx-auto w-full max-w-[28rem]">
          <Rosco letters={letters} label="Letras del rosco de hoy" paused>
            <div className="flex flex-col items-center">
              <span className="font-display text-[17cqw] font-bold leading-none text-cobalt-700">27</span>
              <span className="mt-1 font-display text-[4.4cqw] italic text-ink-700">letras, de la A a la Z</span>
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
              <span className="grid size-12 place-items-center rounded-lg bg-cobalt-600/10 text-cobalt-600">
                <User className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-ink-900">Juega en solitario</h3>
                <p className="text-sm text-ink-600">Un intento diario, contra el reloj</p>
              </div>
            </div>
            <AttemptBadge state={soloState} />
          </div>
          {soloState === "available" ? (
            <div className="mt-6 grid gap-3">
              <Link
                href="/jugar/programa"
                className="group panel-soft flex items-center justify-between gap-4 p-4 transition hover:border-cobalt-600/50"
              >
                <span>
                  <span className="block font-bold text-ink-900">Programa completo</span>
                  <span className="text-sm text-ink-600">
                    {PROGRAM_PHASES.length} pruebas y El Rosco final, unos 8 minutos
                  </span>
                </span>
                <ArrowRight
                  className="size-5 text-cobalt-600 transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/jugar/rosco"
                className="group panel-soft flex items-center justify-between gap-4 p-4 transition hover:border-cobalt-600/50"
              >
                <span>
                  <span className="block font-bold text-ink-900">Solo El Rosco</span>
                  <span className="text-sm text-ink-600">27 letras en 3 minutos</span>
                </span>
                <ArrowRight
                  className="size-5 text-cobalt-600 transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <p className="text-xs text-ink-500">
                Ambas opciones comparten el mismo intento: al empezar una, la otra queda bloqueada hasta mañana.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              <p className="text-ink-700">
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
              <span className="grid size-12 place-items-center rounded-lg bg-saffron-400/20 text-saffron-700">
                <Swords className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-ink-900">Desafía a un amigo</h3>
                <p className="text-sm text-ink-600">1 vs 1 por turnos, con enlace privado</p>
              </div>
            </div>
            <AttemptBadge state={duelState} />
          </div>
          <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-ink-700 marker:text-cobalt-600">
            <li>Cada jugador tiene su propio rosco, sus preguntas y su reloj.</li>
            <li>Si aciertas, sigues. Si fallas o dices «Pasapalabra», tu reloj se para y arranca el del rival.</li>
            <li>Crear la sala no gasta tu intento: se consume al empezar el duelo.</li>
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
                <p className="text-sm text-ink-600">
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
          <h2 id="progreso" className="font-display text-lg font-bold text-ink-900">
            Tu progreso
          </h2>
          <Link href="/estadisticas" className="text-sm font-semibold text-cobalt-600 hover:text-cobalt-600">
            Estadísticas e historial
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={<Flame className="size-5 text-saffron-700" aria-hidden="true" />}
            label="Racha actual"
            value={me?.streak.current ?? 0}
            suffix="días"
          />
          <StatTile
            icon={<Medal className="size-5 text-cobalt-600" aria-hidden="true" />}
            label="Mejor racha"
            value={me?.streak.best ?? 0}
            suffix="días"
          />
          <StatTile
            icon={<Sparkles className="size-5 text-cobalt-500" aria-hidden="true" />}
            label="Mejor rosco"
            value={stats?.solo.bestScoreRosco ?? "—"}
            suffix={stats?.solo.bestScoreRosco != null ? "pts" : ""}
          />
          <StatTile
            icon={<Swords className="size-5 text-ok-700" aria-hidden="true" />}
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
        <BoardCard title="Solo El Rosco" board={boardRosco} />
        <BoardCard title="Programa completo" board={boardProgram} />
      </section>

      {/* ── Programa ── */}
      <section aria-labelledby="programa" className="panel mt-10 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">El programa completo</p>
            <h2 id="programa" className="mt-2 font-display text-2xl font-bold text-ink-900">
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
              <span className="font-display text-3xl font-bold text-cobalt-600">{i + 1}</span>
              <p className="mt-1 font-bold text-ink-900">{PHASE_RULES[kind].title}</p>
              <p className="mt-1 text-sm text-ink-600">{PHASE_RULES[kind].tagline}</p>
            </li>
          ))}
          <li className="panel-soft border-cobalt-600/40 p-4">
            <span className="font-display text-3xl font-bold text-cobalt-600">5</span>
            <p className="mt-1 font-bold text-ink-900">El Rosco</p>
            <p className="mt-1 text-sm text-ink-600">Con los segundos que hayas ganado</p>
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
      <div className="flex items-center gap-2 text-sm font-medium text-ink-600">
        {icon}
        {label}
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-bold text-ink-900">{value}</span>
        {suffix ? <span className="text-sm text-ink-600">{suffix}</span> : null}
      </p>
    </div>
  );
}

function BoardCard({ title, board }: { title: string; board: LeaderboardView | null }) {
  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Clasificación de hoy</p>
          <h3 className="font-display text-xl font-bold text-ink-900">{title}</h3>
        </div>
        <LeaderboardLink />
      </div>
      <div className="mt-4">
        {board ? (
          <LeaderboardTable board={board} />
        ) : (
          <p className="text-sm text-ink-600">La clasificación no está disponible en este momento.</p>
        )}
      </div>
    </div>
  );
}
