/**
 * Selección determinista del contenido de cada día a partir del banco.
 *
 * - Cada grupo (letra del rosco o tipo de prueba) se baraja una sola vez con
 *   una semilla fija; cada día avanza una «ventana» sobre esa permutación, de
 *   modo que el banco se recorre completo antes de repetir elementos.
 * - Se evitan respuestas repetidas en el mismo día y enunciados que revelen
 *   la respuesta de otra pregunta del mismo jugador.
 * - Para el duelo se emparejan preguntas del mismo modo y dificultad para que
 *   ambos roscos sean equivalentes.
 * El resultado se valida y se guarda en la base de datos antes de usarse.
 */
import type { QuestionBank } from "@/content/bank";
import { ALPHABET, type Letter } from "@/lib/game/alphabet";
import type {
  ChallengeContent,
  ContentItem,
  Difficulty,
  PhaseKind,
  QuestionSet,
  QuestionSetKey,
} from "@/lib/game/content-types";
import { dayNumber } from "@/lib/game/daily";
import { normalizeAnswer } from "@/lib/game/normalize";
import { PHASE_RULES, PROGRAM_PHASES } from "@/lib/game/phases";
export { difficultyLabel } from "@/lib/game/phases";
import { seededShuffle, shortHash } from "./hash";
import { promptTexts, textRevealsAnswer } from "./validate";

export class ContentSelectionError extends Error {}

function emptySet(): QuestionSet {
  return { rosco: [], quick: [], clues: [], saying: [], link: [] };
}

function itemsOf(set: QuestionSet): ContentItem[] {
  return [...set.rosco, ...set.quick, ...set.clues, ...set.saying, ...set.link];
}

function conflicts(candidate: ContentItem, chosen: readonly ContentItem[]): boolean {
  for (const other of chosen) {
    for (const text of promptTexts(candidate)) {
      if (other.answers.some((a) => textRevealsAnswer(text.replace(/_+/g, " "), a))) return true;
    }
    for (const text of promptTexts(other)) {
      if (candidate.answers.some((a) => textRevealsAnswer(text.replace(/_+/g, " "), a))) return true;
    }
  }
  return false;
}

class DaySelector {
  readonly usedAnswers = new Set<string>();
  readonly usedIds = new Set<string>();
  readonly sets: Record<QuestionSetKey, QuestionSet> = { solo: emptySet(), duel_a: emptySet(), duel_b: emptySet() };

  eligible(item: ContentItem, key: QuestionSetKey): boolean {
    if (this.usedIds.has(item.id)) return false;
    if (item.answers.some((a) => this.usedAnswers.has(normalizeAnswer(a)))) return false;
    return !conflicts(item, itemsOf(this.sets[key]));
  }

  mark(item: ContentItem): void {
    this.usedIds.add(item.id);
    for (const a of item.answers) this.usedAnswers.add(normalizeAnswer(a));
  }

  /** Primer elemento elegible de la permutación a partir del cursor que cumpla `prefer`. */
  pick<T extends ContentItem>(
    pool: readonly T[],
    cursor: number,
    key: QuestionSetKey,
    preferences: ReadonlyArray<(item: T) => boolean>,
  ): T {
    const n = pool.length;
    for (const prefer of [...preferences, () => true]) {
      for (let k = 0; k < n; k++) {
        const item = pool[(cursor + k) % n]!;
        if (prefer(item) && this.eligible(item, key)) {
          this.mark(item);
          return item;
        }
      }
    }
    throw new ContentSelectionError(`No hay contenido suficiente para ${key} (${pool[0]?.prompt.kind ?? "?"})`);
  }
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export interface SelectionResult {
  content: ChallengeContent;
  difficulty: "facil" | "media" | "dificil";
  difficultyScore: number;
}

/** Construye el contenido completo de una fecha a partir del banco. */
export function selectChallengeContent(bank: QuestionBank, dateKey: string, salt: string): SelectionResult {
  const day = dayNumber(dateKey);
  const sel = new DaySelector();

  // El Rosco: tres preguntas por letra (individual, duelo A, duelo B).
  const byLetter = new Map<Letter, ContentItem[]>();
  for (const item of bank.rosco) {
    const list = byLetter.get(item.prompt.letter) ?? [];
    list.push(item);
    byLetter.set(item.prompt.letter, list);
  }
  for (const letter of ALPHABET) {
    const pool = seededShuffle(byLetter.get(letter) ?? [], `${salt}:rosco:${letter}`) as typeof bank.rosco;
    if (pool.length < 3) throw new ContentSelectionError(`La letra ${letter} necesita al menos 3 preguntas`);
    const cursor = mod(day * 3, pool.length);
    const a = sel.pick(pool, cursor, "duel_a", []);
    const b = sel.pick(pool, cursor + 1, "duel_b", [
      (i) => i.prompt.mode === a.prompt.mode && i.difficulty === a.difficulty,
      (i) => i.prompt.mode === a.prompt.mode,
    ]);
    const solo = sel.pick(pool, cursor + 2, "solo", []);
    sel.sets.duel_a.rosco.push(a);
    sel.sets.duel_b.rosco.push(b);
    sel.sets.solo.rosco.push(solo);
  }

  // Pruebas previas del programa completo.
  for (const kind of PROGRAM_PHASES) {
    const rule = PHASE_RULES[kind];
    const pool = seededShuffle(bank[kind] as ContentItem[], `${salt}:${kind}`);
    const perDay = rule.soloItems + rule.duelItemsPerPlayer * 2;
    if (pool.length < perDay)
      throw new ContentSelectionError(`La prueba ${kind} necesita al menos ${perDay} elementos`);
    let cursor = mod(day * perDay, pool.length);
    for (let i = 0; i < rule.duelItemsPerPlayer; i++) {
      const a = sel.pick(pool, cursor++, "duel_a", []);
      const b = sel.pick(pool, cursor++, "duel_b", [(x) => x.difficulty === a.difficulty]);
      (sel.sets.duel_a[kind] as ContentItem[]).push(a);
      (sel.sets.duel_b[kind] as ContentItem[]).push(b);
    }
    for (let i = 0; i < rule.soloItems; i++) {
      (sel.sets.solo[kind] as ContentItem[]).push(sel.pick(pool, cursor++, "solo", []));
    }
  }

  const soloDifficulty = sel.sets.solo.rosco.reduce((acc, i) => acc + i.difficulty, 0) / ALPHABET.length;
  const difficulty = soloDifficulty < 1.55 ? "facil" : soloDifficulty < 2.05 ? "media" : "dificil";
  return { content: sel.sets, difficulty, difficultyScore: Math.round(soloDifficulty * 100) / 100 };
}

/** Semilla pública (no revela el secreto de selección). */
export function publicSeed(salt: string, dateKey: string, variant: number): string {
  return `${shortHash(`${salt}:${dateKey}`)}-${variant}`;
}

export type { Difficulty, PhaseKind };
