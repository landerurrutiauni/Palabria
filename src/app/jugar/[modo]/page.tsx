import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SoloGame } from "@/components/solo/solo-game";
import { timingFromEnv } from "@/lib/game/config";
import { requirePlayerForPage } from "@/lib/server/page-identity";
import { getTodaySolo } from "@/lib/server/solo-service";

export const dynamic = "force-dynamic";

const MODES = { rosco: "rosco", programa: "program" } as const;

export async function generateMetadata({ params }: { params: Promise<{ modo: string }> }): Promise<Metadata> {
  const { modo } = await params;
  return { title: modo === "programa" ? "Programa completo" : "Solo El Rosco" };
}

export default async function SoloModePage({ params }: { params: Promise<{ modo: string }> }) {
  const { modo } = await params;
  const mode = MODES[modo as keyof typeof MODES];
  if (!mode) notFound();
  const player = await requirePlayerForPage();
  const session = await getTodaySolo(player);
  const timing = timingFromEnv();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <SoloGame
        mode={mode}
        initial={session}
        roscoSeconds={Math.round(timing.soloRoscoMs / 1000)}
        programRoscoSeconds={Math.round(timing.programRoscoBaseMs / 1000)}
      />
    </div>
  );
}
