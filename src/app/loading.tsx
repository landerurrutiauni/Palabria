export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div
          className="size-14 animate-spin rounded-full border-4 border-white/10 border-t-turquoise-400"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-ink-300">Cargando…</p>
      </div>
    </div>
  );
}
