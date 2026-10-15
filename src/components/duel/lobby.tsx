"use client";

import Link from "next/link";
import { CheckCircle2, Clock, Hourglass, LogOut, Mic, MicOff, Swords, UserPlus } from "lucide-react";
import { useState } from "react";
import { Countdown } from "@/components/home/countdown";
import { cn } from "@/lib/client/cn";
import { modeLabel } from "@/lib/game/phases";
import type { DuelPlayerView, DuelView } from "@/lib/views";
import { PresenceDot } from "./connection-badge";
import { DuelRules } from "./duel-rules";
import { InvitePanel } from "./invite-panel";

function Seat({ player, seatLabel, waiting }: { player?: DuelPlayerView; seatLabel: string; waiting?: boolean }) {
  return (
    <div className={cn("panel-soft flex items-center gap-3 p-4", player?.ready && "border-ok-600/50")}>
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full font-display text-lg font-bold",
          player ? "bg-cobalt-600/15 text-ink-900" : "border-2 border-dashed border-glaze-400 text-ink-500",
        )}
        aria-hidden="true"
      >
        {player ? player.name.charAt(0).toUpperCase() : "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-500">{seatLabel}</p>
        {player ? (
          <>
            <p className="truncate font-bold text-ink-900">
              {player.name} {player.isYou ? <span className="text-sm font-semibold text-cobalt-600">(tú)</span> : null}
            </p>
            <PresenceDot connected={player.connected} />
          </>
        ) : (
          <p className="flex items-center gap-2 font-semibold text-ink-600">
            <Hourglass className="size-4 animate-pulse" aria-hidden="true" />
            {waiting ? "Esperando a tu rival…" : "Asiento libre"}
          </p>
        )}
      </div>
      {player ? (
        <span
          className={cn("flex items-center gap-1 text-xs font-bold", player.voice ? "text-ok-700" : "text-ink-500")}
          title={player.voice ? "Acepta jugar con micrófono" : "Sin micrófono"}
        >
          {player.voice ? (
            <Mic className="size-4" aria-hidden="true" />
          ) : (
            <MicOff className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">{player.voice ? "Acepta jugar con micrófono" : "Sin micrófono"}</span>
        </span>
      ) : null}
      {player ? (
        player.ready ? (
          <span className="flex items-center gap-1 text-sm font-bold text-ok-700">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Listo
          </span>
        ) : (
          <span className="text-sm font-semibold text-ink-500">Sin confirmar</span>
        )
      ) : null}
    </div>
  );
}

/** Sala de espera / preparación (estados waiting y ready). */
export function Lobby({
  view,
  busy,
  onReady,
  onVoice,
  onLeave,
}: {
  view: DuelView;
  busy: boolean;
  onReady: (ready: boolean) => void;
  onVoice: (enabled: boolean) => void;
  onLeave: () => void;
}) {
  const me = view.you ? view.players[view.you] : undefined;
  const host = view.players[1];
  const guest = view.players[2];
  const waitingForGuest = view.status === "waiting";
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="panel stage-lights relative overflow-hidden p-6 sm:p-8">
        <p className="eyebrow flex items-center gap-2">
          <Swords className="size-4" aria-hidden="true" />
          Sala privada, {modeLabel(view.mode)}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
          {waitingForGuest ? "Esperando a tu rival" : "¡Todo listo para el duelo!"}
        </h1>
        <p className="mt-2 text-ink-700">
          {waitingForGuest
            ? view.isHost
              ? "Comparte el enlace. En cuanto tu rival acepte y ambos estéis listos, empezará la cuenta atrás."
              : "Tu rival aún no ha entrado."
            : view.isHost
              ? "Tu rival ha aceptado. Pulsa «¡Empezar duelo!» cuando quieras."
              : `Has aceptado el desafío. Esperando a que ${host?.name ?? "el anfitrión"} empiece el duelo.`}
        </p>
        {view.isHost && waitingForGuest ? (
          <div className="mt-6">
            <InvitePanel code={view.code} />
          </div>
        ) : null}
        <div className="mt-6 grid gap-3">
          <Seat player={host} seatLabel="Anfitrión" />
          <Seat player={guest} seatLabel="Invitado" waiting={waitingForGuest} />
        </div>
        {me ? (
          <div className="mt-6 rounded-xl border-2 border-glaze-300 bg-ink-900/[0.06] p-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block font-extrabold text-ink-900">Jugar con micrófono</span>
                <span className="block text-sm text-ink-600">
                  Una voz lee las preguntas y respondes hablando (di «Palabria» para pasar). Solo se activa si los dos
                  lo aceptáis.
                </span>
              </span>
              <input
                type="checkbox"
                className="size-6 shrink-0 accent-[var(--color-ok-600)]"
                checked={me.voice}
                disabled={busy}
                onChange={(e) => onVoice(e.target.checked)}
              />
            </label>
            <p className={cn("mt-2 text-sm font-bold", view.voiceActive ? "text-ok-700" : "text-ink-600")}>
              {view.voiceActive
                ? "Modo voz activado: los dos jugaréis con micrófono."
                : !me.voice
                  ? "Modo voz desactivado."
                  : waitingForGuest
                    ? "Tú lo aceptas; falta que tu rival lo acepte."
                    : "Tú lo aceptas, pero tu rival no: se jugará escribiendo."}
            </p>
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {me && view.isHost ? (
            me.ready ? (
              <button type="button" className="btn btn-ghost" onClick={() => onReady(false)} disabled={busy}>
                {waitingForGuest ? "Ya no empezar automáticamente" : "Cancelar «listo»"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-gold min-h-14 px-8 text-lg"
                onClick={() => onReady(true)}
                disabled={busy}
              >
                <UserPlus className="size-5" aria-hidden="true" />
                {waitingForGuest ? "Empezar en cuanto llegue" : "¡Empezar duelo!"}
              </button>
            )
          ) : null}
          {me && !view.isHost && !me.ready ? (
            <button
              type="button"
              className="btn btn-gold min-h-14 px-8 text-lg"
              onClick={() => onReady(true)}
              disabled={busy}
            >
              ¡Estoy listo!
            </button>
          ) : null}
          <button type="button" className="btn btn-danger" onClick={onLeave} disabled={busy}>
            <LogOut className="size-4" aria-hidden="true" />
            {view.isHost ? "Cancelar sala" : "Salir de la sala"}
          </button>
        </div>
        {me?.ready && view.isHost && waitingForGuest ? (
          <p className="mt-3 text-sm text-ok-700">El duelo empezará automáticamente cuando tu rival acepte.</p>
        ) : null}
        <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <Clock className="size-3.5" aria-hidden="true" />
          {view.expiresAt ? (
            <>
              La sala caduca en <Countdown target={view.expiresAt} serverNow={view.serverNow} /> si no empieza el duelo.
              Al empezar, ambos gastáis vuestro intento 1 vs 1 de hoy.
            </>
          ) : null}
        </p>
      </section>
      <DuelRules
        roscoSeconds={view.rules.roscoSeconds}
        programRoscoSeconds={view.rules.roscoSeconds}
        graceSeconds={view.rules.graceSeconds}
        mode={view.mode}
      />
    </div>
  );
}

/** Invitación para quien abre el enlace (todavía no participa). */
export function Invitation({
  view,
  busy,
  onJoin,
}: {
  view: DuelView;
  busy: boolean;
  onJoin: (voice: boolean) => void;
}) {
  const host = view.players[1];
  const [voice, setVoice] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="panel stage-lights relative overflow-hidden p-6 text-center sm:p-10">
        <p className="eyebrow">Invitación a un duelo 1 vs 1</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-5xl">{view.hostName} te reta</h1>
        <p className="mt-3 text-lg text-ink-700">
          Modalidad: <strong className="text-saffron-700">{modeLabel(view.mode)}</strong>. Mismo desafío del día, roscos
          distintos y equivalentes, turnos con reloj propio.
        </p>
        {view.canJoin ? (
          <label className="mx-auto mt-6 flex max-w-md cursor-pointer items-start gap-3 rounded-xl border-2 border-glaze-300 bg-ink-900/[0.06] p-4 text-left">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-[var(--color-ok-600)]"
              checked={voice}
              onChange={(e) => setVoice(e.target.checked)}
            />
            <span>
              <span className="block font-extrabold text-ink-900">Jugar con micrófono</span>
              <span className="block text-sm text-ink-600">
                {host?.voice
                  ? `${view.hostName} quiere jugar con micrófono. Si lo aceptas, una voz leerá las preguntas y responderéis hablando.`
                  : "Una voz lee las preguntas y respondes hablando. Solo se activa si los dos lo aceptáis."}
              </span>
            </span>
          </label>
        ) : null}
        {view.canJoin ? (
          <button
            type="button"
            className="btn btn-gold mx-auto mt-6 min-h-14 px-10 text-lg"
            onClick={() => onJoin(voice)}
            disabled={busy}
          >
            <Swords className="size-5" aria-hidden="true" />
            {busy ? "Entrando…" : "Aceptar el desafío"}
          </button>
        ) : (
          <p className="mx-auto mt-8 max-w-md rounded-lg border border-saffron-500/40 bg-saffron-400/15 p-4 text-ink-800">
            {view.joinBlockedReason ?? "No puedes unirte a esta sala."}
          </p>
        )}
        <p className="mt-4 text-sm text-ink-500">
          Sin registro: entrarás con tu identidad anónima de este navegador. Aceptar no gasta tu intento hasta que
          empiece el duelo.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-cobalt-600 hover:underline">
          ¿Qué es Palabria?
        </Link>
      </section>
      <DuelRules
        roscoSeconds={view.rules.roscoSeconds}
        programRoscoSeconds={view.rules.roscoSeconds}
        graceSeconds={view.rules.graceSeconds}
        mode={view.mode}
      />
    </div>
  );
}
