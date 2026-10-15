import { isLetter, type Letter } from "@/lib/game/alphabet";
import type {
  CluesItem,
  Difficulty,
  LinkItem,
  QuickItem,
  RoscoItem,
  SayingItem,
} from "@/lib/game/content-types";
import { normalizeAnswer } from "@/lib/game/normalize";
import { shortHash } from "@/lib/content/hash";
import { CLUES_BANK } from "./clues";
import { LINKS_BANK } from "./links";
import { QUICK_BANK } from "./quick";
import { ROSCO_A_F } from "./rosco-a-f";
import { ROSCO_G_M } from "./rosco-g-m";
import { ROSCO_N_R } from "./rosco-n-r";
import { ROSCO_S_Z } from "./rosco-s-z";
import { SAYINGS_BANK } from "./sayings";

export interface QuestionBank {
  rosco: RoscoItem[];
  quick: QuickItem[];
  clues: CluesItem[];
  saying: SayingItem[];
  link: LinkItem[];
}

function splitAnswers(raw: string): string[] {
  return raw
    .split("|")
    .map((a) => a.trim())
    .filter(Boolean);
}

function slug(text: string): string {
  return normalizeAnswer(text).replace(/\s+/g, "-");
}

function letterOf(raw: string): Letter {
  if (!isLetter(raw)) throw new Error(`Letra no válida en el banco: ${raw}`);
  return raw;
}

/** Convierte el formato compacto del banco en elementos tipados con identificador estable. */
export function loadBank(): QuestionBank {
  const rosco: RoscoItem[] = [...ROSCO_A_F, ...ROSCO_G_M, ...ROSCO_N_R, ...ROSCO_S_Z].map(
    ([letter, mode, answers, definition, difficulty]) => {
      const list = splitAnswers(answers);
      return {
        id: `r-${slug(letter)}-${mode}-${slug(list[0] ?? "")}`,
        prompt: { kind: "rosco", letter: letterOf(letter), mode: mode === "s" ? "starts" : "contains", definition },
        answers: list,
        difficulty: difficulty as Difficulty,
      };
    },
  );
  const quick: QuickItem[] = QUICK_BANK.map(([definition, answers, difficulty]) => ({
    id: `q-${shortHash(definition)}`,
    prompt: { kind: "quick", definition },
    answers: splitAnswers(answers),
    difficulty,
  }));
  const clues: CluesItem[] = CLUES_BANK.map(([clueList, answers, difficulty]) => ({
    id: `c-${shortHash(clueList.join("|"))}`,
    prompt: { kind: "clues", clues: [...clueList] },
    answers: splitAnswers(answers),
    difficulty,
  }));
  const saying: SayingItem[] = SAYINGS_BANK.map(([text, answers, difficulty]) => ({
    id: `s-${shortHash(text)}`,
    prompt: { kind: "saying", text },
    answers: splitAnswers(answers),
    difficulty,
  }));
  const link: LinkItem[] = LINKS_BANK.map(([words, answers, difficulty]) => ({
    id: `l-${shortHash(words.join("|"))}`,
    prompt: { kind: "link", words: [...words] },
    answers: splitAnswers(answers),
    difficulty,
  }));
  return { rosco, quick, clues, saying, link };
}

let cached: QuestionBank | null = null;

export function getBank(): QuestionBank {
  cached ??= loadBank();
  return cached;
}

/** Versión del contenido: cambia cuando se edita el banco. */
export function bankVersion(bank: QuestionBank = getBank()): string {
  return `bank-${shortHash(JSON.stringify(bank))}`;
}
