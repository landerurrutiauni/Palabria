/**
 * Validación automática del contenido antes de publicarlo.
 * Un desafío con errores nunca se publica.
 */
import { ALPHABET } from "@/lib/game/alphabet";
import type { ChallengeContent, ContentItem, QuestionSet, QuestionSetKey } from "@/lib/game/content-types";
import { answerMatchesLetter, normalizeAnswer } from "@/lib/game/normalize";
import { PHASE_RULES, PROGRAM_PHASES } from "@/lib/game/phases";

export interface ValidationIssue {
  where: string;
  message: string;
}

const ALLOWED_TEXT = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,;:¿?¡!«»"'()\-–—…/_]+$/u;
const SPANISH_FUNCTION_WORDS = new Set([
  "de", "la", "el", "que", "en", "y", "a", "los", "las", "un", "una", "del", "se", "por", "con", "para", "al", "su",
  "lo", "es", "o", "sin", "sobre", "como", "te", "tu", "le", "no", "mas", "muy", "hay", "sus", "cuyo", "cuya",
  "cuyos", "cuyas", "entre", "desde", "hasta", "mitad", "este", "esta", "ese", "esa",
]);

/** Palabras normalizadas de un texto. */
function tokens(text: string): string[] {
  return normalizeAnswer(text).split(" ").filter(Boolean);
}

/** ¿El texto revela la respuesta? (palabra exacta, o prefijo para respuestas de 4+ letras). */
export function textRevealsAnswer(text: string, answer: string): boolean {
  const target = normalizeAnswer(answer);
  if (!target) return false;
  const norm = normalizeAnswer(text);
  if (target.includes(" ")) return ` ${norm} `.includes(` ${target} `);
  return tokens(text).some((t) => t === target || (target.length >= 4 && t.startsWith(target)));
}

export function promptTexts(item: ContentItem): string[] {
  const p = item.prompt;
  switch (p.kind) {
    case "rosco":
    case "quick":
      return [p.definition];
    case "clues":
      return p.clues;
    case "saying":
      return [p.text];
    case "link":
      return p.words;
  }
}

/** Heurística: palabras funcionales del español, tildes o ñ. */
function looksSpanish(text: string): boolean {
  const words = tokens(text);
  if (words.length < 6) return true;
  if (/[áéíóúüñ¿¡]/i.test(text)) return true;
  return words.some((w) => SPANISH_FUNCTION_WORDS.has(w));
}

/** Valida un elemento individual del banco o de un desafío. */
export function validateItem(item: ContentItem, where = item.id): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (message: string) => issues.push({ where, message });

  if (!item.id) add("Falta el identificador");
  if (![1, 2, 3].includes(item.difficulty)) add("Dificultad fuera de rango (1-3)");
  if (item.answers.length === 0) add("No hay respuestas aceptadas definidas");
  for (const answer of item.answers) {
    if (!normalizeAnswer(answer)) add(`Respuesta vacía tras normalizar: «${answer}»`);
    if (!ALLOWED_TEXT.test(answer)) add(`Caracteres no válidos en la respuesta «${answer}»`);
  }

  const texts = promptTexts(item);
  for (const text of texts) {
    if (!text || text.trim().length === 0) add("Texto vacío");
    else if (!ALLOWED_TEXT.test(text)) add(`Caracteres no válidos en «${text}»`);
    for (const answer of item.answers) {
      if (textRevealsAnswer(text.replace(/_+/g, " "), answer)) add(`El enunciado revela la respuesta «${answer}»`);
    }
  }

  const p = item.prompt;
  switch (p.kind) {
    case "rosco":
      if (p.definition.trim().length < 8) add("Definición demasiado corta");
      if (!looksSpanish(p.definition)) add("La definición no parece estar en español");
      for (const answer of item.answers) {
        if (!answerMatchesLetter(answer, p.letter, p.mode)) {
          add(`«${answer}» no ${p.mode === "starts" ? "empieza por" : "contiene"} la ${p.letter}`);
        }
      }
      break;
    case "quick":
      if (p.definition.trim().length < 8) add("Definición demasiado corta");
      if (!looksSpanish(p.definition)) add("La definición no parece estar en español");
      break;
    case "clues":
      if (p.clues.length !== (PHASE_RULES.clues.maxClues ?? 4)) add("Se necesitan exactamente 4 pistas");
      break;
    case "saying":
      if ((p.text.match(/___/g) ?? []).length !== 1) add("El dicho debe tener exactamente un hueco «___»");
      break;
    case "link":
      if (p.words.length !== 4) add("Se necesitan exactamente 4 palabras");
      if (new Set(p.words.map(normalizeAnswer)).size !== p.words.length) add("Palabras repetidas");
      break;
  }
  return issues;
}

export interface SetRequirements {
  quick: number;
  clues: number;
  saying: number;
  link: number;
}

export function requirementsFor(key: QuestionSetKey): SetRequirements {
  const req = {} as SetRequirements;
  for (const kind of PROGRAM_PHASES) {
    req[kind] = key === "solo" ? PHASE_RULES[kind].soloItems : PHASE_RULES[kind].duelItemsPerPlayer;
  }
  return req;
}

function allItems(set: QuestionSet): ContentItem[] {
  return [...set.rosco, ...set.quick, ...set.clues, ...set.saying, ...set.link];
}

/** Valida el contenido completo de un jugador (rosco + pruebas). */
export function validateQuestionSet(set: QuestionSet, key: QuestionSetKey): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (set.rosco.length !== ALPHABET.length) {
    issues.push({ where: key, message: `El rosco tiene ${set.rosco.length} letras (deben ser 27)` });
  }
  ALPHABET.forEach((letter, i) => {
    const item = set.rosco[i];
    if (!item) {
      issues.push({ where: `${key}/rosco/${letter}`, message: `Falta la pregunta de la letra ${letter}` });
    } else if (item.prompt.letter !== letter) {
      issues.push({ where: `${key}/rosco/${letter}`, message: `Posición ${i} ocupada por la letra ${item.prompt.letter}` });
    }
  });
  const req = requirementsFor(key);
  for (const kind of PROGRAM_PHASES) {
    if (set[kind].length < req[kind]) {
      issues.push({ where: `${key}/${kind}`, message: `Contenido insuficiente: ${set[kind].length} de ${req[kind]}` });
    }
  }
  const items = allItems(set);
  for (const item of items) issues.push(...validateItem(item, `${key}/${item.id}`));

  // Ningún enunciado del mismo jugador puede revelar otra respuesta suya.
  for (const a of items) {
    for (const b of items) {
      if (a === b) continue;
      for (const text of promptTexts(a)) {
        for (const answer of b.answers) {
          if (textRevealsAnswer(text.replace(/_+/g, " "), answer)) {
            issues.push({ where: `${key}/${a.id}`, message: `Revela la respuesta de ${b.id} («${answer}»)` });
          }
        }
      }
    }
  }
  return issues;
}

/** Valida un desafío diario completo antes de publicarlo. */
export function validateChallenge(content: ChallengeContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const keys: QuestionSetKey[] = ["solo", "duel_a", "duel_b"];
  for (const key of keys) issues.push(...validateQuestionSet(content[key], key));

  // Sin respuestas duplicadas en todo el desafío del día.
  const seen = new Map<string, string>();
  for (const key of keys) {
    for (const item of allItems(content[key])) {
      for (const answer of item.answers) {
        const norm = normalizeAnswer(answer);
        const previous = seen.get(norm);
        if (previous && previous !== `${key}/${item.id}`) {
          issues.push({ where: `${key}/${item.id}`, message: `Respuesta duplicada en el desafío: «${answer}» (también en ${previous})` });
        } else {
          seen.set(norm, `${key}/${item.id}`);
        }
      }
    }
  }
  return issues;
}

/** Valida el banco: cada elemento por separado e identificadores únicos. */
export function validateBank(bank: Record<string, ContentItem[]>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const [pool, items] of Object.entries(bank)) {
    for (const item of items) {
      if (ids.has(item.id)) issues.push({ where: `${pool}/${item.id}`, message: "Identificador duplicado" });
      ids.add(item.id);
      issues.push(...validateItem(item, `${pool}/${item.id}`));
    }
  }
  return issues;
}
