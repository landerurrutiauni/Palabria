import type { Metadata } from "next";
import Link from "next/link";
import { Ban, SearchX } from "lucide-react";
import { RoomClient } from "@/components/duel/room-client";
import { StateScreen } from "@/components/ui/notice";
import { AppError } from "@/lib/server/errors";
import { requirePlayerForPage } from "@/lib/server/page-identity";
import { getRoomView } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sala 1 vs 1",
  robots: { index: false },
};

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const player = await requirePlayerForPage();
  let snapshot: Awaited<ReturnType<typeof getRoomView>> | null = null;
  let failure: AppError | null = null;
  try {
    snapshot = await getRoomView(player, code);
  } catch (error) {
    if (error instanceof AppError && (error.code === "room_full" || error.code === "room_not_found")) failure = error;
    else throw error;
  }
  if (failure || !snapshot) {
    const full = failure?.code === "room_full";
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
  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <RoomClient code={code} initial={snapshot.view} />
    </div>
  );
}
