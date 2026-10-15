"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Settings, Swords, Trophy, User } from "lucide-react";
import { cn } from "@/lib/client/cn";

const LINKS = [
  { href: "/jugar", label: "Jugar", icon: User },
  { href: "/duelo", label: "1 vs 1", icon: Swords },
  { href: "/clasificacion", label: "Clasificación", icon: Trophy },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex items-center gap-0.5 sm:gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 min-w-10 items-center justify-center gap-2 rounded-md px-2 text-[0.95rem] font-semibold transition-colors md:px-3",
              active
                ? "bg-cobalt-50 text-cobalt-700 shadow-[inset_0_-2px_0_var(--color-cobalt-600)]"
                : "text-ink-600 hover:bg-cobalt-50 hover:text-cobalt-700",
            )}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
            <span className="sr-only md:not-sr-only">{label}</span>
          </Link>
        );
      })}
      <Link
        href="/ajustes"
        aria-current={pathname === "/ajustes" ? "page" : undefined}
        className={cn(
          "grid size-10 place-items-center rounded-md transition-colors",
          pathname === "/ajustes"
            ? "bg-cobalt-50 text-cobalt-700"
            : "text-ink-600 hover:bg-cobalt-50 hover:text-cobalt-700",
        )}
      >
        <Settings className="size-[18px]" aria-hidden="true" />
        <span className="sr-only">Ajustes de sonido y accesibilidad</span>
      </Link>
    </nav>
  );
}
