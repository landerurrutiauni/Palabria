import type { Metadata } from "next";
import { StaticHistory } from "@/components/static/screens";

export const metadata: Metadata = { title: "Historial" };

export default function HistoryPage() {
  return <StaticHistory />;
}
