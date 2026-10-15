import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-glaze-300 bg-glaze-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Palabria es un concurso diario de palabras inspirado en los concursos de televisión. Sin cuentas: tu progreso
          se guarda de forma anónima en este navegador.
        </p>
        <nav aria-label="Pie de página" className="flex gap-4">
          <Link className="hover:text-ink-800" href="/como-se-juega">
            Cómo se juega
          </Link>
          <Link className="hover:text-ink-800" href="/ajustes">
            Ajustes
          </Link>
        </nav>
      </div>
    </footer>
  );
}
