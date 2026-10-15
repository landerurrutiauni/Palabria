"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Clock4 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/providers/settings-provider";
import { Notice, StateScreen } from "@/components/ui/notice";
import { api, ApiError, newActionId } from "@/lib/client/api";
import { useRoomSync } from "@/lib/client/use-room-sync";
import type { DuelView, FeedbackView } from "@/lib/views";
import { DuelBoard, type DuelActionInput } from "./duel-board";
import { DuelResult } from "./duel-result";
import { Invitation, Lobby } from "./lobby";

interface ActionResponse {
  view: DuelView;
  feedback: FeedbackView | null;
  duplicate: boolean;
}

export function RoomClient({ code, initial }: { code: string; initial: DuelView }) {
  const { view, status, fatal, refresh, accept } = useRoomSync(code, initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [feedback, setFeedback] = useState<{ fb: FeedbackView; stamp: number } | null>(null);
  const [failed, setFailed] = useState<{ actionId: string; action: DuelActionInput } | null>(null);
  const busyRef = useRef(false);
  const { play } = useSettings();
  const router = useRouter();
  const lastStatus = useRef(view.status);

  useEffect(() => {
    if (lastStatus.current !== view.status) {
      if (view.status === "in_progress") play("start");
      if (view.status === "completed" || view.status === "abandoned")
        play(view.result?.outcome === "win" ? "win" : "end");
      lastStatus.current = view.status;
    }
  }, [view.status, view.result?.outcome, play]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        const result = await fn();
        setError(null);
        return result;
      } catch (e) {
        if (e instanceof ApiError) {
          setError(e);
          if (!e.isNetwork) void refresh();
        }
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );

  const post = (path: string, body: unknown = {}) =>
    run(async () => {
      const res = await api<{ room?: DuelView }>(`/api/rooms/${code}/${path}`, { body });
      if (res.room) accept(res.room);
      return res;
    });

  const act = useCallback(
    (action: DuelActionInput, actionId = newActionId()) =>
      run(async () => {
        try {
          const res = await api<ActionResponse>(`/api/rooms/${code}/action`, { body: { actionId, action } });
          accept(res.view);
          setFailed(null);
          if (res.feedback) {
            setFeedback({ fb: res.feedback, stamp: Date.now() });
            if (res.feedback.outcome === "correct") play("correct");
            else if (res.feedback.outcome === "wrong") play("wrong");
            else if (res.feedback.outcome === "passed") play("pass");
          }
          return res;
        } catch (e) {
          if (e instanceof ApiError && e.isNetwork) setFailed({ actionId, action });
          throw e;
        }
      }),
    [code, run, accept, play],
  );

  if (fatal) {
    return (
      <StateScreen
        icon={<Ban className="size-9 text-bad-700" />}
        eyebrow="Sala privada"
        title={fatal.code === "room_full" ? "Esta sala es privada" : "No se puede acceder a la sala"}
        actions={
          <Link href="/duelo" className="btn btn-gold">
            Crear mi propia sala
          </Link>
        }
      >
        {fatal.message}
      </StateScreen>
    );
  }

  const errorNotice = error ? (
    <Notice
      tone={error.isNetwork ? "offline" : "error"}
      title={error.isNetwork ? "Sin conexión con el servidor" : "Acción no realizada"}
      className="mb-4"
      action={
        failed ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void act(failed.action, failed.actionId)}
            disabled={busy}
          >
            Reintentar
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setError(null)}>
            Cerrar
          </button>
        )
      }
    >
      {error.message}
      {error.isNetwork ? " Tu partida sigue guardada en el servidor; al reconectar verás el estado real." : ""}
    </Notice>
  ) : null;

  if (view.status === "expired") {
    return (
      <StateScreen
        icon={<Clock4 className="size-9 text-saffron-700" />}
        eyebrow="Sala privada"
        title={view.result?.endReason === "cancelled" ? "Sala cancelada" : "Sala caducada"}
        actions={
          <>
            <Link href="/duelo" className="btn btn-gold">
              Crear una sala nueva
            </Link>
            <Link href="/" className="btn btn-ghost">
              Portada
            </Link>
          </>
        }
      >
        {view.result?.endReason === "cancelled"
          ? "El anfitrión cerró esta sala antes de empezar. No se ha gastado ningún intento."
          : "Esta sala no llegó a empezar a tiempo (o era de un día anterior). No se ha gastado ningún intento."}
      </StateScreen>
    );
  }

  if (view.you === null) {
    return (
      <>
        {errorNotice}
        <Invitation view={view} busy={busy} onJoin={(voice) => void post("join", { voice })} />
      </>
    );
  }

  if (view.status === "waiting" || view.status === "ready") {
    return (
      <>
        {errorNotice}
        <Lobby
          view={view}
          busy={busy}
          onReady={(ready) => void post("ready", { ready })}
          onVoice={(enabled) => void post("voice", { enabled })}
          onLeave={() =>
            void post("leave").then((r) => {
              if (r) router.push(view.isHost ? "/duelo" : "/");
            })
          }
        />
      </>
    );
  }

  if (view.status === "completed" || view.status === "abandoned") {
    return <DuelResult view={view} />;
  }

  return (
    <>
      {errorNotice}
      <DuelBoard
        view={view}
        syncStatus={status}
        busy={busy}
        feedback={feedback}
        onAction={(action) => void act(action)}
        onLeave={() => void post("leave").then(() => refresh())}
        onExpire={() => void refresh()}
      />
    </>
  );
}
