"use client";

import Link from "next/link";
import { CheckCircle2, Hourglass } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/providers/settings-provider";
import { Notice, StateScreen } from "@/components/ui/notice";
import { api, ApiError, newActionId } from "@/lib/client/api";
import { estimateServerNow, useNow, useServerOffset } from "@/lib/client/time";
import type { SoloAction } from "@/lib/game/solo-engine";
import { modeLabel, type GameMode } from "@/lib/game/phases";
import type { FeedbackView, SoloView } from "@/lib/views";
import { PhaseStage } from "./phase-stage";
import { ProgramStepper } from "./program-stepper";
import { RoscoStage } from "./rosco-stage";
import { SoloPrep } from "./solo-prep";
import { SoloResult } from "./solo-result";
import { StageIntro } from "./stage-intro";

interface ActionResponse {
  view: SoloView;
  feedback: FeedbackView | null;
  duplicate: boolean;
}

export function SoloGame({
  mode,
  initial,
  roscoSeconds,
  programRoscoSeconds,
}: {
  mode: GameMode;
  initial: SoloView | null;
  roscoSeconds: number;
  programRoscoSeconds: number;
}) {
  const [session, setSession] = useState<SoloView | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [failed, setFailed] = useState<{ actionId: string; action: SoloAction } | null>(null);
  const [feedback, setFeedback] = useState<{ fb: FeedbackView; stamp: number } | null>(null);
  const { play } = useSettings();
  const offset = useServerOffset(session?.serverNow);
  const playing = session?.status === "in_progress" && session.stage.status === "playing";
  const tick = useNow(playing, 200);
  const now = estimateServerNow(tick, offset, session?.serverNow ?? 0);
  const remainingMs =
    playing && session.stage.startedAt !== null
      ? Math.max(0, session.stage.timeLimitMs - Math.max(0, now - session.stage.startedAt))
      : (session?.stage.remainingMs ?? 0);
  const busyRef = useRef(false);
  const lastTick = useRef<number | null>(null);
  const previousStatus = useRef(session?.status);

  const accept = useCallback((next: SoloView | null) => {
    setSession((current) => {
      if (!next) return current;
      if (!current || current.sessionId !== next.sessionId || next.version >= current.version) return next;
      return current;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ session: SoloView | null }>("/api/solo");
      accept(res.session);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError) setError(e);
    }
  }, [accept]);

  // Cuando el reloj llega a cero, el servidor cierra la prueba: se sincroniza.
  const expired = playing && remainingMs <= 0;
  useEffect(() => {
    if (!expired) return;
    const id = window.setTimeout(refresh, 350);
    return () => window.clearTimeout(id);
  }, [expired, refresh]);

  // Al volver a la pestaña se recalcula todo desde el servidor.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [refresh]);

  // Pitidos de los últimos cinco segundos.
  useEffect(() => {
    if (!playing) return;
    const s = Math.ceil(remainingMs / 1000);
    if (s <= 5 && s > 0 && lastTick.current !== s) {
      lastTick.current = s;
      play("tick");
    }
  }, [playing, remainingMs, play]);

  useEffect(() => {
    if (previousStatus.current === "in_progress" && session && session.status !== "in_progress") play("end");
    previousStatus.current = session?.status;
  }, [session, play]);

  const send = useCallback(
    async (action: SoloAction, actionId = newActionId()) => {
      if (!session || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const res = await api<ActionResponse>("/api/solo/action", {
          body: { sessionId: session.sessionId, actionId, action },
        });
        accept(res.view);
        setError(null);
        setFailed(null);
        if (res.feedback) {
          setFeedback({ fb: res.feedback, stamp: Date.now() });
          if (res.feedback.outcome === "correct") play("correct");
          else if (res.feedback.outcome === "wrong") play("wrong");
          else if (res.feedback.outcome === "passed") play("pass");
        }
        if (action.type === "start_stage") {
          setFeedback(null);
          play("start");
        }
      } catch (e) {
        if (e instanceof ApiError) {
          setError(e);
          if (e.isNetwork) setFailed({ actionId, action });
          else void refresh();
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [session, accept, play, refresh],
  );

  const start = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await api<{ session: SoloView }>("/api/solo", { body: { mode } });
      accept(res.session);
      setError(null);
      play("start");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e);
        void refresh();
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const errorNotice = error ? (
    <Notice
      tone={error.isNetwork ? "offline" : "error"}
      title={error.isNetwork ? "Sin conexión con el servidor" : "No se ha podido completar la acción"}
      action={
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => (failed ? void send(failed.action, failed.actionId) : void refresh())}
          disabled={busy}
        >
          Reintentar
        </button>
      }
    >
      {error.message}
      {error.isNetwork ? " Tu partida está guardada en el servidor y el reloj sigue su curso." : ""}
    </Notice>
  ) : null;

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        {errorNotice}
        <SoloPrep
          mode={mode}
          roscoSeconds={roscoSeconds}
          programRoscoSeconds={programRoscoSeconds}
          busy={busy}
          onStart={start}
        />
      </div>
    );
  }

  if (session.mode !== mode) {
    const inProgress = session.status === "in_progress";
    const href = session.mode === "program" ? "/jugar/programa" : "/jugar/rosco";
    return (
      <StateScreen
        icon={
          inProgress ? <Hourglass className="size-9 text-gold-300" /> : <CheckCircle2 className="size-9 text-ok-400" />
        }
        eyebrow="Desafío individual"
        title={inProgress ? "Ya tienes una partida en curso" : "Desafío ya completado"}
        actions={
          <>
            <Link href={href} className="btn btn-primary">
              {inProgress ? `Continuar ${modeLabel(session.mode)}` : "Ver mi resultado"}
            </Link>
            <Link href="/duelo" className="btn btn-ghost">
              Jugar un 1 vs 1
            </Link>
          </>
        }
      >
        Hoy ya has usado tu intento individual con «{modeLabel(session.mode)}». El programa completo y El Rosco
        comparten un único intento al día. Mañana a las 00:00 (hora de España) tendrás un desafío nuevo. Tu duelo 1 vs 1
        es independiente.
      </StateScreen>
    );
  }

  if (session.result) {
    return (
      <div className="flex flex-col gap-4">
        {errorNotice}
        <SoloResult result={session.result} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ProgramStepper stages={session.stages} current={session.stageIndex} />
      {errorNotice}
      {session.stage.status === "ready" ? (
        <StageIntro
          view={session}
          busy={busy}
          onStart={() => send({ type: "start_stage", stage: session.stageIndex })}
        />
      ) : session.stage.kind === "rosco" ? (
        <RoscoStage
          view={session}
          remainingMs={remainingMs}
          busy={busy}
          feedback={feedback}
          onAnswer={(text, item) => send({ type: "answer", stage: session.stageIndex, item, text })}
          onPass={(item) => send({ type: "pass", stage: session.stageIndex, item })}
        />
      ) : (
        <PhaseStage
          view={session}
          remainingMs={remainingMs}
          busy={busy}
          feedback={feedback}
          onAnswer={(text, item) => send({ type: "answer", stage: session.stageIndex, item, text })}
          onPass={(item) => send({ type: "pass", stage: session.stageIndex, item })}
          onClue={(item) => send({ type: "clue", stage: session.stageIndex, item })}
        />
      )}
    </div>
  );
}
