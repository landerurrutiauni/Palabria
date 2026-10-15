import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-night-950/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded-xl" aria-label="Palabría, ir a la portada">
          <Logo />
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
