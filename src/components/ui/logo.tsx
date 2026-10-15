import { cn } from "@/lib/client/cn";

/** Emblema: un rosco de 27 puntos con la letra activa en turquesa. */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  const dots = Array.from({ length: 27 }, (_, i) => {
    const angle = ((-90 + (i * 360) / 27) * Math.PI) / 180;
    return { x: 24 + 19.5 * Math.cos(angle), y: 24 + 19.5 * Math.sin(angle), i };
  });
  const color = (i: number) =>
    i === 0 ? "#33e6d7" : i === 8 || i === 17 ? "#ffc94a" : i % 5 === 2 ? "#4fe39a" : "rgba(130,152,255,0.75)";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id="lm-core" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#7652f0" />
          <stop offset="100%" stopColor="#152056" />
        </radialGradient>
      </defs>
      {dots.map((d) => (
        <circle key={d.i} cx={d.x} cy={d.y} r={d.i === 0 ? 2.6 : 1.9} fill={color(d.i)} />
      ))}
      <circle cx="24" cy="24" r="12.5" fill="url(#lm-core)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <path d="M20 31.5V17h5.2a4.6 4.6 0 0 1 0 9.2H20" fill="none" stroke="#f5f7ff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Logotipo tipográfico «PALABRÍA» con la tilde dorada. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="Palabría">
      <LogoMark size={compact ? 32 : 40} className="size-8 sm:size-10" />
      <span aria-hidden="true" className="font-display text-[0.95rem] font-extrabold tracking-[0.1em] text-ink-50 sm:text-xl sm:tracking-[0.12em]">
        PALABR
        <span className="relative inline-block">
          I
          <span className="absolute -top-[0.34em] left-1/2 h-[0.3em] w-[0.14em] -translate-x-[15%] rotate-[38deg] rounded-full bg-gold-400 shadow-[0_0_10px_rgba(255,201,74,0.8)]" />
        </span>
        A
      </span>
    </span>
  );
}
