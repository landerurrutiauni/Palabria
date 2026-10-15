import type { Metadata } from "next";
import { StaticDuelHome } from "@/components/static/screens";

export const metadata: Metadata = { title: "Desafía a un amigo" };

export default function DuelPage() {
  return <StaticDuelHome />;
}
