import type { Metadata } from "next";
import { StaticStats } from "@/components/static/screens";

export const metadata: Metadata = { title: "Estadísticas" };

export default function StatsPage() {
  return <StaticStats />;
}
