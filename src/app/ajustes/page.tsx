import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { SettingsForm } from "@/components/settings/settings-form";
import { requirePlayerForPage } from "@/lib/server/page-identity";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const player = await requirePlayerForPage();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Preferencias</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink-50 sm:text-4xl">Ajustes de sonido y accesibilidad</h1>
      <div className="mt-8">
        <SettingsForm displayName={player.displayName} />
      </div>
      <section className="panel-soft mt-6 flex gap-4 p-5" aria-labelledby="identidad">
        <ShieldCheck className="mt-1 size-6 shrink-0 text-turquoise-300" aria-hidden="true" />
        <div className="text-sm text-ink-200">
          <h2 id="identidad" className="font-semibold text-ink-50">
            Tu identidad anónima
          </h2>
          <p className="mt-1">
            No hay cuentas ni contraseñas. Al entrar por primera vez, el servidor te asignó un identificador aleatorio que se
            guarda en una cookie protegida (HttpOnly) de este navegador. Sirve para recordar tus intentos diarios, tu racha y tu
            historial. No usamos huellas digitales del dispositivo ni pedimos datos personales.
          </p>
          <p className="mt-2 text-ink-300">
            Limitación: si borras las cookies o juegas desde otro navegador tendrás una identidad nueva (sin historial). Los
            límites diarios se aplican a cada identidad anónima; no es posible garantizar de forma absoluta que una misma
            persona no use varias.
          </p>
        </div>
      </section>
    </div>
  );
}
