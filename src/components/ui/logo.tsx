import { cn } from "@/lib/client/cn";

/** Emblema: una bola azul del rosco con la P de Palabria. */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id="logo-ball" cx="34%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#8af59a" />
          <stop offset="40%" stopColor="#2fc24c" />
          <stop offset="100%" stopColor="#148028" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="21.5" fill="url(#logo-ball)" stroke="#ffffff" strokeWidth="3" />
      <text
        x="24"
        y="32"
        textAnchor="middle"
        fontFamily="'Nunito Variable', system-ui, sans-serif"
        fontWeight="900"
        fontSize="24"
        fill="#ffffff"
      >
        P
      </text>
    </svg>
  );
}

/** Logotipo: «Palabria». */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="Palabria">
      <LogoMark size={compact ? 32 : 40} className="size-9 sm:size-10" />
      <span
        aria-hidden="true"
        className="text-[1.55rem] font-black leading-none tracking-tight text-white [text-shadow:0_2px_0_rgb(0_0_0/0.25)] sm:text-[1.75rem]"
      >
        Palabria
      </span>
    </span>
  );
}
