"use client";

/**
 * Pantallas de la versión estática (GitHub Pages + Supabase). Reutilizan las
 * mismas vistas que la versión con servidor, pero cargan los datos desde la
 * API (Supabase Edge Function) en el navegador.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ban, SearchX } from "lucide-react";
import { RoomClient } from "@/components/duel/room-client";
import { HomeView, type ChallengeInfo } from "@/components/home/home-view";
import { DuelHomeView } from "@/components/pages/duel-home-view";
import { HistoryPageView } from "@/components/pages/history-page-view";
import { LeaderboardPageView } from "@/components/pages/leaderboard-page-view";
import { PlaySelectionView } from "@/components/pages/play-selection-view";
import { SettingsPageView } from "@/components/pages/settings-page-view";
import { StatsPageView } from "@/components/pages/stats-page-view";
import { SoloGame } from "@/components/solo/solo-game";
import { SoloResult } from "@/components/solo/solo-result";
import { StateScreen } from "@/components/ui/notice";
import { api, ApiError } from "@/lib/client/api";
import type { TimingConfig } from "@/lib/game/config";
import { isDateKey } from "@/lib/game/daily";
import type { GameMode } from "@/lib/game/phases";
import type { DuelView, LeaderboardView, MeView, SoloView, StatsView } from "@/lib/views";
import { Loaded, useLoad } from "./use-load";

type ChallengeResponse = ChallengeInfo & { timing: TimingConfig };

/** Un fallo secundario (estadísticas, clasificación) no impide mostrar la pantalla. */
function optional<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch(() => null);
}

const loadHome = async () => {
  const [challenge, me, stats, boardRosco, boardProgram] = await Promise.all([
    api<ChallengeResponse>("/api/challenge"),
    optional(api<MeView>("/api/me")),
    optional(api<StatsView>("/api/stats")),
    optional(api<LeaderboardView>("/api/leaderboard?mode=rosco&limit=5")),
    optional(api<LeaderboardView>("/api/leaderboard?mode=program&limit=5")),
  ]);
  return { challenge, me, stats, boardRosco, boardProgram };
};

export function StaticHome() {
  const state = useLoad(loadHome, "home");
  return <Loaded state={state}>{(data) => <HomeView data={data} />}</Loaded>;
}

const loadMeAndTiming = async () => {
  const [me, challenge] = await Promise.all([api<MeView>("/api/me"), api<ChallengeResponse>("/api/challenge")]);
  return { me, timing: challenge.timing };
};

export function StaticPlaySelection() {
  const state = useLoad(loadMeAndTiming, "me");
  return <Loaded state={state}>{(d) => <PlaySelectionView me={d.me} timing={d.timing} />}</Loaded>;
}

export function StaticDuelHome() {
  const state = useLoad(loadMeAndTiming, "me");
  return <Loaded state={state}>{(d) => <DuelHomeView me={d.me} timing={d.timing} />}</Loaded>;
}

const loadSolo = async () => {
  const [solo, challenge] = await Promise.all([
    api<{ session: SoloView | null }>("/api/solo"),
    api<ChallengeResponse>("/api/challenge"),
  ]);
  return { session: solo.session, timing: challenge.timing };
};

export function StaticSoloGame({ mode }: { mode: GameMode }) {
  const state = useLoad(loadSolo, "solo");
  return (
    <Loaded state={state}>
      {(d) => (
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <SoloGame
            mode={mode}
            initial={d.session}
            roscoSeconds={Math.round(d.timing.soloRoscoMs / 1000)}
            programRoscoSeconds={Math.round(d.timing.programRoscoBaseMs / 1000)}
          />
        </div>
      )}
    </Loaded>
  );
}

type RoomLoad = { view: DuelView } | { failure: "room_full" | "room_not_found" };

const loadRoom = async (code: string): Promise<RoomLoad> => {
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(code)) return { failure: "room_not_found" };
  try {
    return { view: (await api<{ room: DuelView }>(`/api/rooms/${code}`)).room };
  } catch (error) {
    if (error instanceof ApiError && (error.code === "room_full" || error.code === "room_not_found")) {
      return { failure: error.code };
    }
    throw error;
  }
};

function RoomUnavailable({ full }: { full: boolean }) {
  return (
    <StateScreen
      icon={full ? <Ban className="size-9 text-bad-700" /> : <SearchX className="size-9 text-ink-700" />}
      eyebrow="Sala privada"
      title={full ? "Esta sala es privada" : "Sala no encontrada"}
      actions={
        <>
          <Link href="/duelo" className="btn btn-gold">
            Crear mi propia sala
          </Link>
          <Link href="/" className="btn btn-ghost">
            Ir a la portada
          </Link>
        </>
      }
    >
      {full
        ? "Ya hay dos jugadores en esta sala y solo ellos pueden verla. Si eres uno de ellos, abre el enlace desde el mismo navegador con el que entraste."
        : "El enlace no es correcto o la sala ya no existe. Pide a tu amigo que te envíe el enlace de nuevo."}
    </StateScreen>
  );
}

export function StaticRoom() {
  const code = useSearchParams().get("c") ?? "";
  const state = useLoad(loadRoom, code);
  return (
    <Loaded state={state}>
      {(d) =>
        "failure" in d ? (
          <RoomUnavailable full={d.failure === "room_full"} />
        ) : (
          <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
            <RoomClient key={code} code={code} initial={d.view} />
          </div>
        )
      }
    </Loaded>
  );
}

const loadStats = () => api<StatsView>("/api/stats");

export function StaticStats() {
  const state = useLoad(loadStats, "stats");
  return <Loaded state={state}>{(stats) => <StatsPageView stats={stats} />}</Loaded>;
}

export function StaticHistory() {
  const state = useLoad(loadStats, "stats");
  return <Loaded state={state}>{(stats) => <HistoryPageView entries={stats.history} />}</Loaded>;
}

const loadResult = async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    return (await api<{ session: SoloView }>(`/api/results/${id}`)).session.result ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

export function StaticHistoryDetail() {
  const id = useSearchParams().get("id") ?? "";
  const state = useLoad(loadResult, id);
  return (
    <Loaded state={state}>
      {(result) =>
        result ? (
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <Link href="/historial" className="text-sm font-semibold text-cobalt-600 hover:underline">
              ← Volver al historial
            </Link>
            <div className="mt-4">
              <SoloResult result={result} />
            </div>
          </div>
        ) : (
          <StateScreen
            icon={<SearchX className="size-9 text-ink-700" />}
            eyebrow="Historial"
            title="Resultado no encontrado"
            actions={
              <Link href="/historial" className="btn btn-primary">
                Volver al historial
              </Link>
            }
          >
            Solo puedes ver los resultados de tus propias partidas desde este navegador.
          </StateScreen>
        )
      }
    </Loaded>
  );
}

const loadLeaderboard = async (key: string) => {
  const [fecha, modo] = key.split("|");
  const mode: GameMode = modo === "programa" ? "program" : "rosco";
  const { today } = await api<{ today: string }>("/api/health");
  const date = fecha && isDateKey(fecha) && fecha <= today ? fecha : today;
  const board = await optional(api<LeaderboardView>(`/api/leaderboard?date=${date}&mode=${mode}`));
  return { board, date, today, mode };
};

export function StaticLeaderboard() {
  const params = useSearchParams();
  const state = useLoad(loadLeaderboard, `${params.get("fecha") ?? ""}|${params.get("modo") ?? ""}`);
  return (
    <Loaded state={state}>
      {(d) => <LeaderboardPageView board={d.board} date={d.date} today={d.today} mode={d.mode} />}
    </Loaded>
  );
}

const loadMe = () => api<MeView>("/api/me");

export function StaticSettings() {
  const state = useLoad(loadMe, "me");
  return <Loaded state={state}>{(me) => <SettingsPageView displayName={me.displayName} />}</Loaded>;
}
