/**
 * Construcción de vistas seguras (sin respuestas no reveladas) a partir del
 * estado del motor y del contenido del desafío.
 */
import { ALPHABET } from "@/lib/game/alphabet";
import type { ContentItem, PhaseKind, QuestionSet, RoscoItem } from "@/lib/game/content-types";
import { formatClock } from "@/lib/game/clock";
import { formatShortDate } from "@/lib/game/daily";
import { phaseHint } from "@/lib/game/hints";
import { canRevealClue, type PhaseItemProgress } from "@/lib/game/phase-items";
import { PHASE_RULES, modeLabel, phasePointsFor, type GameMode } from "@/lib/game/phases";
import { letterVisualState, type RoscoProgress } from "@/lib/game/rosco";
import type { LetterView, PhaseItemView, PhaseReview, PromptView, RevealedLetter } from "@/lib/views";

export function roscoPrompt(item: RoscoItem, index: number): PromptView {
  return {
    kind: "rosco",
    index,
    letter: item.prompt.letter,
    mode: item.prompt.mode,
    definition: item.prompt.definition,
  };
}

export function phasePrompt(
  kind: PhaseKind,
  item: ContentItem,
  index: number,
  progress: PhaseItemProgress,
): PromptView {
  const hint = phaseHint(kind, item.answers[0] ?? "");
  const p = item.prompt;
  switch (p.kind) {
    case "quick":
      return { kind: "quick", index, definition: p.definition, hint };
    case "clues":
      return {
        kind: "clues",
        index,
        clues: p.clues.slice(0, Math.max(1, progress.cluesShown)),
        totalClues: p.clues.length,
        hint,
        canRevealClue: canRevealClue("clues", progress),
        pointsNow: phasePointsFor("clues", progress.cluesShown),
      };
    case "saying":
      return { kind: "saying", index, text: p.text, hint };
    case "link":
      return { kind: "link", index, words: p.words, hint };
    default:
      throw new Error(`Tipo de pregunta inesperado: ${p.kind}`);
  }
}

export function lettersView(set: QuestionSet, rosco: RoscoProgress, finished: boolean): LetterView[] {
  return ALPHABET.map((letter, i) => ({
    letter,
    mode: set.rosco[i]?.prompt.mode ?? "starts",
    state: letterVisualState(rosco, i, finished),
  }));
}

/** Respuestas de letras cerradas (acierto o fallo); las pasadas siguen ocultas. */
export function revealedClosedLetters(set: QuestionSet, rosco: RoscoProgress): Record<number, string> {
  const out: Record<number, string> = {};
  rosco.statuses.forEach((s, i) => {
    if (s === "correct" || s === "wrong") out[i] = set.rosco[i]?.answers[0] ?? "";
  });
  return out;
}

export function phaseItemsView(
  kind: PhaseKind,
  set: QuestionSet,
  items: readonly PhaseItemProgress[],
): PhaseItemView[] {
  return items.map((it, index) => ({
    index,
    outcome: it.outcome,
    points: it.points,
    answer: it.outcome === "pending" ? null : (set[kind][index]?.answers[0] ?? null),
    given: it.given,
  }));
}

export function fullLetters(
  set: QuestionSet,
  rosco: RoscoProgress,
  given: readonly (string | null)[],
): RevealedLetter[] {
  return ALPHABET.map((letter, i) => {
    const item = set.rosco[i]!;
    return {
      letter,
      mode: item.prompt.mode,
      definition: item.prompt.definition,
      answer: item.answers[0] ?? "",
      given: given[i] ?? null,
      status: rosco.statuses[i] ?? "pending",
    };
  });
}

function promptSummary(item: ContentItem): string {
  const p = item.prompt;
  switch (p.kind) {
    case "rosco":
    case "quick":
      return p.definition;
    case "clues":
      return p.clues.join(" · ");
    case "saying":
      return p.text;
    case "link":
      return p.words.join(" · ");
  }
}

export function phaseReview(kind: PhaseKind, set: QuestionSet, items: readonly PhaseItemProgress[]): PhaseReview {
  return {
    kind,
    title: PHASE_RULES[kind].title,
    points: items.reduce((a, i) => a + i.points, 0),
    items: items.map((it, i) => ({
      prompt: promptSummary(set[kind][i]!),
      answer: set[kind][i]?.answers[0] ?? "",
      given: it.given,
      outcome: it.outcome,
      points: it.points,
    })),
  };
}

export function emojiGrid(rosco: RoscoProgress): string {
  const symbols = rosco.statuses.map((s) => (s === "correct" ? "🟢" : s === "wrong" ? "🔴" : "⚪"));
  const rows: string[] = [];
  for (let i = 0; i < symbols.length; i += 9) rows.push(symbols.slice(i, i + 9).join(""));
  return rows.join("\n");
}

export function soloShareText(args: {
  date: string;
  mode: GameMode;
  correct: number;
  wrong: number;
  unanswered: number;
  timeMs: number;
  score: number;
  rosco: RoscoProgress;
  url: string | null;
}): string {
  const lines = [
    `Palabria · ${formatShortDate(args.date)} · ${modeLabel(args.mode)}`,
    `✅ ${args.correct}  ❌ ${args.wrong}  ⏳ ${args.unanswered}  ⏱ ${formatClock(args.timeMs)}`,
    emojiGrid(args.rosco),
    `Puntuación: ${args.score}`,
  ];
  if (args.url) lines.push(args.url);
  return lines.join("\n");
}
