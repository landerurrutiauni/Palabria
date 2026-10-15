import type { Metadata } from "next";
import { Suspense } from "react";
import { StaticLeaderboard } from "@/components/static/screens";
import { LoadingScreen } from "@/components/ui/loading-screen";

export const metadata: Metadata = { title: "Clasificación" };

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <StaticLeaderboard />
    </Suspense>
  );
}
