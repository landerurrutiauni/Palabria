import type { Metadata } from "next";
import { StaticPlaySelection } from "@/components/static/screens";

export const metadata: Metadata = { title: "Jugar en solitario" };

export default function PlaySelectionPage() {
  return <StaticPlaySelection />;
}
