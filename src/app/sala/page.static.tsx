import type { Metadata } from "next";
import { Suspense } from "react";
import { StaticRoom } from "@/components/static/screens";
import { LoadingScreen } from "@/components/ui/loading-screen";

export const metadata: Metadata = { title: "Sala 1 vs 1", robots: { index: false } };

/** Sala privada: /sala/?c=<código> (versión estática). */
export default function RoomPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <StaticRoom />
    </Suspense>
  );
}
