import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-glaze-0/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded-full" aria-label="Palabria, ir a la portada">
          <Logo />
        </Link>
        <NavLinks />
      </div>
      <div className="light-bars" aria-hidden="true" />
    </header>
  );
}
