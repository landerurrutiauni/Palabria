import type { LetterMode } from "./alphabet";

/** Longitud máxima aceptada para una respuesta escrita. */
export const MAX_ANSWER_LENGTH = 60;

const N_TILDE_PLACEHOLDER = "\u0001";
const LEADING_ARTICLES = /^(el|la|los|las|un|una|unos|unas|lo)\s+/;

/**
 * Normaliza una respuesta para compararla:
 *  - minúsculas,
 *  - sin tildes ni diéresis (á→a, ü→u),
 *  - conserva la Ñ (nunca se confunde con la N),
 *  - signos de puntuación y guiones → espacio,
 *  - espacios colapsados y recortados.
 */
export function normalizeAnswer(raw: string): string {
  let s = raw.normalize("NFC").toLocaleLowerCase("es-ES");
  s = s.replace(/ñ/g, N_TILDE_PLACEHOLDER);
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(new RegExp(N_TILDE_PLACEHOLDER, "g"), "ñ");
  s = s.replace(/[^a-zñ0-9\s]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function compact(s: string): string {
  return s.replace(/\s/g, "");
}

function sameAnswer(a: string, b: string): boolean {
  return a === b || compact(a) === compact(b);
}

/**
 * Comprueba una respuesta contra la lista explícita de respuestas aceptadas.
 * Solo se admiten variantes que estén definidas en `accepted`.
 * Se tolera un artículo inicial («la montaña» → «montaña») si la
 * respuesta oficial no lo incluye.
 */
export function isCorrectAnswer(input: string, accepted: readonly string[]): boolean {
  const given = normalizeAnswer(input.slice(0, MAX_ANSWER_LENGTH * 2));
  if (!given) return false;
  const targets = accepted.map(normalizeAnswer).filter(Boolean);
  if (targets.some((t) => sameAnswer(given, t))) return true;
  const withoutArticle = given.replace(LEADING_ARTICLES, "");
  if (withoutArticle !== given && withoutArticle) {
    return targets.some((t) => sameAnswer(withoutArticle, t));
  }
  return false;
}

/** Letra normalizada (minúscula, sin tilde, conservando la ñ). */
export function normalizeLetter(letter: string): string {
  return normalizeAnswer(letter);
}

/** ¿La respuesta cumple la condición de su letra («empieza por» / «contiene»)? */
export function answerMatchesLetter(answer: string, letter: string, mode: LetterMode): boolean {
  const a = compact(normalizeAnswer(answer));
  const l = normalizeLetter(letter);
  if (!a || l.length !== 1) return false;
  return mode === "starts" ? a.startsWith(l) : a.includes(l);
}

/** Pista de longitud: número de letras de la respuesta canónica (sin espacios). */
export function letterCount(answer: string): number {
  return compact(normalizeAnswer(answer)).length;
}

/** Limpia la entrada del usuario antes de guardarla (no altera la comparación). */
export function sanitizeGivenAnswer(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ANSWER_LENGTH);
}
