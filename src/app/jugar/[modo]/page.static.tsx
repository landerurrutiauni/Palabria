import type { Metadata } from "next";
import { StaticSoloGame } from "@/components/static/screens";

const MODES = { rosco: "rosco", programa: "program" } as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(MODES).map((modo) => ({ modo }));
}

export async function generateMetadata({ params }: { params: Promise<{ modo: string }> }): Promise<Metadata> {
  const { modo } = await params;
  return { title: modo === "programa" ? "Programa completo" : "Solo El Rosco" };
}

export default async function SoloModePage({ params }: { params: Promise<{ modo: string }> }) {
  const { modo } = await params;
  return <StaticSoloGame mode={MODES[modo as keyof typeof MODES] ?? "rosco"} />;
}
