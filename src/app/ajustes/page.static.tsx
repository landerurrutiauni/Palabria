import type { Metadata } from "next";
import { StaticSettings } from "@/components/static/screens";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return <StaticSettings />;
}
