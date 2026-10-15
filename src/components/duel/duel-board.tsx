"use client";

import { Eye, Flag, Pause } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/providers/settings-provider";
import { AnswerForm } from "@/components/game/answer-form";
import { FeedbackBanner } from "@/components/game/feedback";
import { QuestionCard } from "@/components/game/question-card";
import { Rosco } from "@/components/game/rosco";
import { StatChips } from "@/components/game/stat-chips";
import { TimerDisplay } from "@/components/game/timer";
import { ItemDots } from "@/components/solo/phase-stage";
import { cn } from "@/lib/client/cn";
import { estimateServerNow, useNow, useServerOffset } from "@/lib/client/time";
import type { SyncStatus } from "@/lib/client/use-room-sync";
import { formatClock } from "@/lib/game/clock";
import { stageTitle } from "@/lib/game/phases";
import type { DuelPlayerView, DuelView, FeedbackView, Seat } from "@/lib/views";
import { ConnectionBadge, PresenceDot } from "./connection-badge";

export type DuelActionInput =
  | { type: "answer"; stage: number; item: number; text: string }
  | { type: "pass"; stage: number; item: number }
  | { type: "clue"; stage: number; item: number };

function statusNote(p: DuelPlayerView): string | null {
  if (p.status === "finished") return "Ha terminado su rosco";
  if (p.status === "out_of_time") return "Sin tiempo";
  if (p.status === "abandoned") return "Abandonó";
  return null;
}

function PlayerPanel({
  player,
  active,
  remainingMs,
  totalMs,
  isRosco,
  className,
}: {
  player: DuelPlayerView;
  active: boolean;
  remainingMs: number;
  totalMs: number;
  isRosco: boolean;
  className?: string;
}) {
  const note = statusNote(player);
  return (
    <section
      className={cn(
        "panel flex flex-col gap-4 p-4 transition-shadow sm:p-5",
        active ? "turn-glow" : "opacity-95",
        className,
      )}
      aria-label={`${player.isYou ? "Tu marcador" : `Marcador de ${player.name}`}${active ? ", tiene el turno" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-ink-900">
            {player.name}
            {player.isYou ? <span className="ml-2 text-sm font-semibold text-cobalt-600">(tú)</span> : null}
          </p>
          <PresenceDot connected={player.connected} />
        </div>
        {active ? (
          <span className="rounded-full bg-cobalt-600 px-3 py-1 text-xs font-black text-night">Turno</span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-ink-900/[0.04] px-3 py-1 text-xs font-bold text-ink-600">
            <Pause className="size-3" aria-hidden="true" /> En pausa
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <TimerDisplay
          remainingMs={remainingMs}
          totalMs={totalMs}
          running={active && isRosco}
          label={isRosco ? (player.isYou ? "Tu reloj" : "Su reloj") : "Rosco"}
          size="md"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <StatChips correct={player.correct} wrong={player.wrong} open={player.open} compact />
          {!isRosco ? (
            <p className="text-sm text-ink-600">
              Pruebas: <strong className="score-digits text-lg text-ink-900">{player.phasePoints}</strong> pts ·{" "}
              <strong className="text-saffron-700">+{player.bonusSeconds} s</strong>
            </p>
          ) : null}
          {note ? <p className="text-sm font-semibold text-saffron-700">{note}</p> : null}
        </div>
      </div>
      {!isRosco && player.phaseOutcomes.length > 0 ? (
        <ItemDots items={player.phaseOutcomes.map((o) => ({ outcome: o }))} current={null} />
      ) : null}
      <div className="mx-auto w-full max-w-[22rem]">
        <Rosco
          letters={player.letters}
          label={player.isYou ? "Tu rosco" : `Rosco de ${player.name}`}
          paused={!active || !isRosco}
        />
      </div>
    </section>
  );
}

/** Tablero del duelo en curso (turnos con reloj propio). */
export function DuelBoard({
  view,
  syncStatus,
  busy,
  feedback,
  onAction,
  onLeave,
  onExpire,
}: {
  view: DuelView;
  syncStatus: SyncStatus;
  busy: boolean;
  feedback: { fb: FeedbackView; stamp: number } | null;
  onAction: (action: DuelActionInput) => void;
  onLeave: () => void;
  onExpire: () => void;
}) {
  const { play } = useSettings();
  const offset = useServerOffset(view.serverNow);
  const tick = useNow(true, 200);
  const now = estimateServerNow(tick, offset, view.serverNow);
  const you = view.you as Seat;
  const rivalSeat: Seat = you === 1 ? 2 : 1;
  const me = view.players[you]!;
  const rival = view.players[rivalSeat]!;
  const isRosco = view.stage.kind === "rosco";
  const startedAt = view.turn.startedAt;
  const countdownMs = startedAt !== null ? startedAt - now : 0;
  const inCountdown = countdownMs > 0;
  const activeSeat = view.turn.seat;
  const myTurn = activeSeat === you && !inCountdown;

  const remainingOf = (seat: Seat): number => {
    const p = view.players[seat]!;
    if (!isRosco || activeSeat !== seat || startedAt === null) return p.bankMs;
    return Math.max(0, p.bankMs - Math.max(0, now - startedAt));
  };
  const shotRemaining =
    !isRosco && startedAt !== null && view.turn.shotClockMs !== null
      ? Math.max(0, view.turn.shotClockMs - Math.max(0, now - startedAt))
      : null;
  const activeExpired =
    !inCountdown && activeSeat !== null && (isRosco ? remainingOf(activeSeat) <= 0 : shotRemaining === 0);

  // Reloj vencido: se pide al servidor que aplique el cambio de turno.
  useEffect(() => {
    if (!activeExpired) return;
    const id = window.setTimeout(onExpire, 300);
    return () => window.clearTimeout(id);
  }, [activeExpired, onExpire, view.turn.number]);

  // Relevo de turno: aviso breve que no bloquea ni retrasa el juego.
  const [flash, setFlash] = useState<{ title: string; subtitle: string; tone: string; key: number } | null>(null);
  const lastTurn = useRef(view.turn.number);
  useEffect(() => {
    if (view.turn.number === lastTurn.current) return;
    lastTurn.current = view.turn.number;
    const la = view.lastAction;
    const nextIsMe = view.turn.seat === you;
    const title =
      la?.outcome === "passed"
        ? "¡Palabria!"
        : la?.outcome === "wrong"
          ? "¡Fallo!"
          : la?.outcome === "timeout"
            ? "¡Tiempo!"
            : stageTitle(view.stage.kind);
    setFlash({
      title,
      subtitle: nextIsMe ? "¡Te toca!" : `Turno de ${rival.name}`,
      tone:
        la?.outcome === "passed" ? "text-saffron-700" : la?.outcome === "wrong" ? "text-bad-700" : "text-cobalt-600",
      key: view.turn.number,
    });
    if (nextIsMe) play("turn");
    else if (la?.seat === rivalSeat && la.outcome === "passed") play("pass");
    const id = window.setTimeout(() => setFlash(null), 1100);
    return () => window.clearTimeout(id);
  }, [view.turn.number, view.turn.seat, view.lastAction, view.stage.kind, you, rival.name, rivalSeat, play]);

  // Pitidos de los últimos segundos de mi reloj.
  const lastTick = useRef<number | null>(null);
  const myRemaining = isRosco ? remainingOf(you) : (shotRemaining ?? 0);
  useEffect(() => {
    if (!myTurn) return;
    const s = Math.ceil(myRemaining / 1000);
    if (s <= 5 && s > 0 && lastTick.current !== s) {
      lastTick.current = s;
      play("tick");
    }
  }, [myTurn, myRemaining, play]);

  const prompt = myTurn ? view.prompt : null;
  const totalMs = view.rules.roscoSeconds * 1000 + Math.max(me.bonusSeconds, rival.bonusSeconds) * 1000;
  const waitingText =
    me.status === "finished"
      ? "Has terminado tu rosco. Tu rival juega con su propio tiempo."
      : me.status === "out_of_time"
        ? "Te has quedado sin tiempo. Tu rival sigue con el suyo."
        : `Turno de ${rival.name}. Tu reloj está detenido en ${formatClock(remainingOf(you))}.`;

  const leave = () => {
    if (window.confirm("¿Seguro que quieres abandonar? Contará como derrota y no recuperarás el intento de hoy."))
      onLeave();
  };

  return (
    <div className="relative flex flex-col gap-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">
            {view.stages.length > 1 ? `Prueba ${view.stage.index + 1} de ${view.stages.length}` : "Duelo"}
          </span>
          <h1 className="font-display text-xl font-bold text-ink-900">{view.stage.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge status={syncStatus} />
          <button type="button" className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={leave}>
            <Flag className="size-4" aria-hidden="true" />
            Abandonar
          </button>
        </div>
      </div>

      {/* Marcador compacto (móvil) */}
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        {[me, rival].map((p) => {
          const active = activeSeat === p.seat && !inCountdown;
          return (
            <div key={p.seat} className={cn("panel-soft flex items-center gap-2 p-2.5", active && "turn-glow")}>
              <div className="w-14 shrink-0">
                {activeSeat !== p.seat || inCountdown ? (
                  <Rosco letters={p.letters} label={p.isYou ? "Tu rosco" : `Rosco de ${p.name}`} paused />
                ) : (
                  <div className="grid size-14 place-items-center rounded-full bg-cobalt-600/10 text-xs font-bold text-cobalt-600">
                    Turno
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-900">{p.isYou ? "Tú" : p.name}</p>
                <p
                  className={cn(
                    "score-digits text-2xl leading-none",
                    active && isRosco ? "text-ink-900" : "text-ink-600",
                  )}
                >
                  {formatClock(remainingOf(p.seat))}
                </p>
                <p className="text-xs font-semibold">
                  <span className="text-ok-700">✓ {p.correct}</span> <span className="text-bad-700">✕ {p.wrong}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <PlayerPanel
          player={me}
          active={activeSeat === you && !inCountdown}
          remainingMs={remainingOf(you)}
          totalMs={totalMs}
          isRosco={isRosco}
          className="hidden lg:flex"
        />

        <div className="flex flex-col gap-4">
          {/* Rosco dominante en móvil: el del jugador que tiene el turno */}
          {activeSeat ? (
            <div className="mx-auto w-full max-w-[13.5rem] sm:max-w-[20rem] lg:hidden">
              <Rosco
                letters={view.players[activeSeat]!.letters}
                label={activeSeat === you ? "Tu rosco" : `Rosco de ${rival.name}`}
                paused={!isRosco || inCountdown}
              >
                <div className="flex flex-col items-center">
                  <span className="score-digits text-[17cqw] leading-none text-ink-900">
                    {formatClock(isRosco ? remainingOf(activeSeat) : (shotRemaining ?? 0))}
                  </span>
                  <span className="mt-1 text-[4.6cqw] font-extrabold text-ink-700">
                    {activeSeat === you ? "Tu turno" : "Su turno"}
                  </span>
                </div>
              </Rosco>
            </div>
          ) : null}

          <div
            className={cn(
              "rounded-full px-5 py-2 text-center font-display text-base font-bold sm:py-3 sm:text-lg",
              inCountdown
                ? "bg-saffron-400/20 text-saffron-700"
                : myTurn
                  ? "bg-cobalt-600 text-night shadow-glow-turn"
                  : "bg-ink-900/[0.04] text-ink-600",
            )}
            role="status"
            aria-live="assertive"
          >
            {inCountdown
              ? `Empieza en ${Math.ceil(countdownMs / 1000)}…`
              : myTurn
                ? "¡Tu turno!"
                : `Turno de ${rival.name}`}
          </div>

          {!isRosco && shotRemaining !== null && !inCountdown ? (
            <div className="panel-soft p-3">
              <div className="flex items-center justify-between text-sm font-semibold text-ink-700">
                <span>Tiempo de jugada</span>
                <span className={cn("score-digits text-2xl", shotRemaining <= 5000 ? "text-bad-700" : "text-ink-900")}>
                  {formatClock(shotRemaining)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-900/[0.07]" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", shotRemaining <= 5000 ? "bg-bad-600" : "bg-cobalt-600")}
                  style={{ width: `${(shotRemaining / (view.turn.shotClockMs ?? 1)) * 100}%` }}
                />
              </div>
            </div>
          ) : null}

          {inCountdown ? (
            <div className="panel grid place-items-center p-8 text-center">
              <p className="eyebrow">{view.stage.title}</p>
              <p
                className="score-digits mt-2 animate-pop text-8xl text-saffron-700"
                key={Math.ceil(countdownMs / 1000)}
              >
                {Math.ceil(countdownMs / 1000)}
              </p>
              <p className="mt-2 max-w-sm text-sm text-ink-600">{view.stage.howTo}</p>
            </div>
          ) : prompt ? (
            <QuestionCard prompt={prompt} />
          ) : (
            <div className="panel p-6 text-center">
              <Pause className="mx-auto size-8 text-ink-600" aria-hidden="true" />
              <p className="mt-3 text-lg font-semibold text-ink-800">{waitingText}</p>
              <p className="mt-1 text-sm text-ink-500">Puedes consultar tu rosco y el marcador mientras esperas.</p>
            </div>
          )}

          <FeedbackBanner feedback={feedback?.fb ?? null} stamp={feedback?.stamp ?? 0} />

          <div className="sticky bottom-0 z-10 -mx-3 border-t border-glaze-200 bg-glaze-0/90 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <AnswerForm
              promptKey={`${view.stage.index}-${prompt?.index ?? "x"}-${view.turn.number}`}
              disabled={!prompt}
              disabledReason={myTurn ? undefined : inCountdown ? "Preparados…" : "Turno de tu rival"}
              busy={busy}
              passLabel={isRosco ? "Palabria" : "Paso"}
              onAnswer={(text) =>
                prompt && onAction({ type: "answer", stage: view.stage.index, item: prompt.index, text })
              }
              onPass={() => prompt && onAction({ type: "pass", stage: view.stage.index, item: prompt.index })}
              extra={
                prompt?.kind === "clues" ? (
                  <button
                    type="button"
                    className="btn btn-ghost min-h-14"
                    disabled={!prompt.canRevealClue || busy}
                    onClick={() => onAction({ type: "clue", stage: view.stage.index, item: prompt.index })}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    Otra pista
                  </button>
                ) : undefined
              }
            />
          </div>
        </div>

        <PlayerPanel
          player={rival}
          active={activeSeat === rivalSeat && !inCountdown}
          remainingMs={remainingOf(rivalSeat)}
          totalMs={totalMs}
          isRosco={isRosco}
          className="hidden lg:flex"
        />
      </div>

      {flash ? (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center" aria-hidden="true">
          <div
            key={flash.key}
            className="animate-flash rounded-xl border border-glaze-300 bg-glaze-0/85 px-10 py-6 text-center shadow-tile backdrop-blur"
          >
            <p className={cn("font-display text-4xl font-bold sm:text-5xl", flash.tone)}>{flash.title}</p>
            <p className="mt-2 text-lg font-semibold text-ink-800">{flash.subtitle}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
