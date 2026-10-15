import { cn } from "@/lib/client/cn";

/** Emblema: un plato de cerámica con las 27 letras como puntos de cobalto y la P de Palabría. */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  const dots = Array.from({ length: 27 }, (_, i) => {
    const angle = ((-90 + (i * 360) / 27) * Math.PI) / 180;
    return { x: 24 + 19 * Math.cos(angle), y: 24 + 19 * Math.sin(angle), i };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <circle cx="24" cy="24" r="23" fill="#ffffff" stroke="#1d3fa6" strokeWidth="2" />
      {dots.map((d) => (
        <circle key={d.i} cx={d.x} cy={d.y} r={d.i === 0 ? 2.4 : 1.55} fill={d.i === 0 ? "#e9b331" : "#1d3fa6"} />
      ))}
      <text
        x="24"
        y="31.5"
        textAnchor="middle"
        fontFamily="'Ibarra Real Nova', Georgia, serif"
        fontWeight="700"
        fontSize="22"
        fill="#1d3fa6"
      >
        P
      </text>
    </svg>
  );
}

/** Logotipo: «Palabría» en la tipografía de Ibarra. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="Palabría">
      <LogoMark size={compact ? 32 : 40} className="size-9 sm:size-10" />
      <span
        aria-hidden="true"
        className="font-display text-[1.6rem] font-bold leading-none text-ink-900 sm:text-[1.85rem]"
      >
        Palabría
      </span>
    </span>
  );
}
