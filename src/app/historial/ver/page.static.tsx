import type { Metadata } from "next";
import { Suspense } from "react";
import { StaticHistoryDetail } from "@/components/static/screens";
import { LoadingScreen } from "@/components/ui/loading-screen";

export const metadata: Metadata = { title: "Resultado", robots: { index: false } };

/** Detalle de un resultado: /historial/ver/?id=<id> (versión estática). */
export default function HistoryDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <StaticHistoryDetail />
    </Suspense>
  );
}
