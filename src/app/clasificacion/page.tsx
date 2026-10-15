import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LeaderboardTable } from "@/components/home/leaderboard-preview";
import { cn } from "@/lib/client/cn";
import { addDays, formatChallengeDate, isDateKey } from "@/lib/game/daily";
import { todayKey } from "@/lib/server/challenges";
import { serverNow } from "@/lib/server/clock";
import { getDb } from "@/lib/server/db";
import { currentPlayer } from "@/lib/server/identity";
import { getLeaderboard } from "@/lib/server/stats-service";
import { maybeSweep } from "@/lib/server/sweeper";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clasificación" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ fecha?: string; modo?: string }> }) {
  const sp = await searchParams;
  const db = await getDb();
  const today = todayKey(await serverNow(db));
  const date = sp.fecha && isDateKey(sp.fecha) && sp.fecha <= today ? sp.fecha : today;
  const mode = sp.modo === "programa" ? "program" : "rosco";
  const player = await currentPlayer();
  maybeSweep();
  let board = null;
  try {
    board = await getLeaderboard(db, { date, mode, playerId: player?.id ?? null, limit: 50 });
  } catch (error) {
    console.error("[clasificación]", error);
  }
  const link = (d: string, m: string) => `/clasificacion?fecha=${d}&modo=${m === "program" ? "programa" : "rosco"}`;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Clasificación diaria</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink-50 sm:text-4xl">Los mejores del día</h1>
      <p className="mt-2 text-ink-300">
        Solo se muestran nombres visibles y datos de juego. Orden: puntos, aciertos, menos fallos y menos tiempo.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full bg-white/5 p-1" role="tablist" aria-label="Modalidad">
          {(["rosco", "program"] as const).map((m) => (
            <Link
              key={m}
              href={link(date, m)}
              role="tab"
              aria-selected={mode === m}
              className={cn("rounded-full px-4 py-2 text-sm font-semibold", mode === m ? "bg-turquoise-400 text-night-950" : "text-ink-200 hover:text-ink-50")}
            >
              {m === "rosco" ? "Solo El Rosco" : "Programa completo"}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href={link(addDays(date, -1), mode)} className="btn btn-ghost !min-h-10 !px-3" aria-label="Día anterior">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          <span className="min-w-44 text-center text-sm font-semibold text-ink-100">{formatChallengeDate(date, { weekday: false })}</span>
          {date < today ? (
            <Link href={link(addDays(date, 1), mode)} className="btn btn-ghost !min-h-10 !px-3" aria-label="Día siguiente">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className="btn btn-ghost !min-h-10 !px-3 opacity-30" aria-hidden="true">
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      </div>
      <div className="panel mt-6 p-4 sm:p-6">
        {board ? (
          <LeaderboardTable board={board} limit={50} />
        ) : (
          <p className="text-ink-300">La clasificación no está disponible ahora mismo. El juego sigue funcionando con normalidad.</p>
        )}
      </div>
      {board?.you ? (
        <p className="mt-4 text-sm text-ink-200">
          Tu posición: <strong className="text-ink-50">#{board.you.rank}</strong> de {board.total} con {board.you.score} puntos.
        </p>
      ) : null}
    </div>
  );
}
