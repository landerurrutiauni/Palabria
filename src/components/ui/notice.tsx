import { AlertTriangle, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/client/cn";

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "error" | "offline" | "success";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = tone === "offline" ? WifiOff : AlertTriangle;
  return (
    <div
      role={tone === "error" || tone === "offline" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
        tone === "error" && "border-bad-600/50 bg-bad-50",
        tone === "offline" && "border-saffron-500/50 bg-saffron-400/15",
        tone === "info" && "border-cobalt-600/30 bg-cobalt-50",
        tone === "success" && "border-ok-600/40 bg-ok-50",
        className,
      )}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-ink-800" aria-hidden="true" />
        <div>
          <p className="font-semibold text-ink-900">{title}</p>
          {children ? <div className="mt-1 text-sm text-ink-700">{children}</div> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Pantalla completa para estados de error o informativos (sala caducada, desafío completado…). */
export function StateScreen({
  icon,
  eyebrow,
  title,
  children,
  actions,
}: {
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-14 text-center sm:py-20">
      <div className="mx-auto grid size-20 place-items-center rounded-xl border border-glaze-200 bg-ink-900/[0.04] text-ink-900 shadow-tile">
        {icon}
      </div>
      {eyebrow ? <p className="eyebrow mt-6">{eyebrow}</p> : null}
      <h1 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">{title}</h1>
      {children ? <div className="mt-4 text-lg text-ink-700">{children}</div> : null}
      {actions ? <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}
