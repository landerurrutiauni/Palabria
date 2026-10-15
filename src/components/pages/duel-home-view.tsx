import type { TimingConfig } from "@/lib/game/config";
import { roomHref } from "@/lib/client/runtime";
import type { MeView } from "@/lib/views";
import Link from "next/link";
import { CheckCircle2, DoorOpen } from "lucide-react";
import { CreateRoomForm } from "@/components/duel/create-room-form";
import { DuelRules } from "@/components/duel/duel-rules";
import { StateScreen } from "@/components/ui/notice";

export function DuelHomeView({ me, timing }: { me: MeView; timing: TimingConfig }) {
  const duel = me.attempts.duel;

  if (duel.used) {
    return (
      <StateScreen
        icon={<CheckCircle2 className="size-9 text-ok-700" />}
        eyebrow="1 vs 1"
        title={duel.status === "in_progress" ? "Tu duelo de hoy está en marcha" : "Ya has jugado tu duelo de hoy"}
        actions={
          <>
            {duel.roomCode ? (
              <Link href={roomHref(duel.roomCode)} className="btn btn-primary">
                {duel.status === "in_progress" ? "Volver al duelo" : "Ver el resultado"}
              </Link>
            ) : null}
            <Link href="/" className="btn btn-ghost">
              Volver a la portada
            </Link>
          </>
        }
      >
        Cada identidad tiene un único duelo 1 vs 1 al día, independiente del intento individual. El nuevo desafío llega
        a las 00:00 (hora de España).
      </StateScreen>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="panel p-6 sm:p-8">
        <p className="eyebrow">1 vs 1 en sala privada</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">Desafía a un amigo</h1>
        <p className="mt-3 text-ink-700">
          Crea una sala, comparte el enlace por WhatsApp, Telegram o como quieras y jugad desde vuestros dispositivos.
          Sin registro: cada navegador tiene su identidad anónima.
        </p>
        {duel.openRoomCode ? (
          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-saffron-500/40 bg-saffron-400/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm text-ink-800">
              <DoorOpen className="size-5 text-saffron-700" aria-hidden="true" />
              Ya tienes una sala abierta. Si creas otra, la anterior se cerrará.
            </p>
            <Link href={roomHref(duel.openRoomCode)} className="btn btn-gold shrink-0">
              Volver a mi sala
            </Link>
          </div>
        ) : null}
        <CreateRoomForm />
      </section>
      <DuelRules
        roscoSeconds={Math.round(timing.duelRoscoMs / 1000)}
        programRoscoSeconds={Math.round(timing.duelProgramRoscoBaseMs / 1000)}
        graceSeconds={Math.round(timing.reconnectGraceMs / 1000)}
      />
    </div>
  );
}
