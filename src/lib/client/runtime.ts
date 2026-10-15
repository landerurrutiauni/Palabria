/**
 * Diferencias entre los dos despliegues:
 *  - Servidor Node.js (Next.js completo): rutas dinámicas y API en /api.
 *  - GitHub Pages + Supabase (exportación estática): rutas con parámetros en
 *    la consulta (?c=, ?id=), prefijo de ruta del repositorio y API en la
 *    Supabase Edge Function.
 */
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function roomHref(code: string): string {
  return IS_STATIC ? `/sala/?c=${encodeURIComponent(code)}` : `/sala/${code}`;
}

export function historyHref(resultId: string): string {
  return IS_STATIC ? `/historial/ver/?id=${encodeURIComponent(resultId)}` : `/historial/${resultId}`;
}

/** URL absoluta de una ruta de la aplicación (solo en el navegador). */
export function absoluteUrl(path: string): string {
  return `${window.location.origin}${BASE_PATH}${path}`;
}
