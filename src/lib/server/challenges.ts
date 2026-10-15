/**
 * Publicación y lectura de desafíos diarios.
 *
 * Un desafío se genera una sola vez por fecha (Europe/Madrid), se valida y se
 * guarda en la base de datos antes de usarse. A partir de ese momento su
 * contenido es inmutable: todos los jugadores de ese día reciben exactamente
 * las mismas preguntas, aunque cambie el banco o se recargue la página.
 */
import fs from "node:fs";
import path from "node:path";
import { bankVersion, getBank, type QuestionBank } from "@/content/bank";
import { ALPHABET, type LetterMode } from "@/lib/game/alphabet";
import type {
  ChallengeContent,
  ContentItem,
  Difficulty,
  QuestionPrompt,
  QuestionSet,
  QuestionSetKey,
  StageKind,
} from "@/lib/game/content-types";
import { challengeDateKey, isDateKey } from "@/lib/game/daily";
import { publicSeed, selectChallengeContent, type SelectionResult } from "@/lib/content/select";
import { validateChallenge, type ValidationIssue } from "@/lib/content/validate";
import type { Queryable } from "./db-core";
import { serverEnv } from "./env";

export interface ChallengeRecord {
  id: string;
  date: string;
  publicId: string;
  contentVersion: string;
  difficulty: "facil" | "media" | "dificil";
  difficultyScore: number;
  source: "bank" | "override" | "reserve";
}

interface ChallengeRow {
  id: string;
  challenge_date: string;
  public_id: string;
  content_version: string;
  difficulty: ChallengeRecord["difficulty"];
  difficulty_score: number;
  source: ChallengeRecord["source"];
}

function toRecord(row: ChallengeRow): ChallengeRecord {
  return {
    id: row.id,
    date: row.challenge_date,
    publicId: row.public_id,
    contentVersion: row.content_version,
    difficulty: row.difficulty,
    difficultyScore: Number(row.difficulty_score),
    source: row.source,
  };
}

export function todayKey(now: number): string {
  return challengeDateKey(now);
}

export function publicChallengeId(dateKey: string): string {
  return `PAL-${dateKey.replace(/-/g, "")}`;
}

interface Candidate {
  source: ChallengeRecord["source"];
  seed: string;
  version: string;
  selection: SelectionResult;
}

function loadOverride(dateKey: string): ChallengeContent | null {
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), serverEnv().overridesDir, `${dateKey}.json`);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as ChallengeContent;
}

function difficultyOf(content: ChallengeContent): Pick<SelectionResult, "difficulty" | "difficultyScore"> {
  const avg = content.solo.rosco.reduce((acc, i) => acc + i.difficulty, 0) / Math.max(1, content.solo.rosco.length);
  return {
    difficulty: avg < 1.55 ? "facil" : avg < 2.05 ? "media" : "dificil",
    difficultyScore: Math.round(avg * 100) / 100,
  };
}

/** Contenido de reserva: selección fija del banco, validada por las pruebas automáticas. */
export function reserveContent(bank: QuestionBank, salt: string): SelectionResult {
  return selectChallengeContent(bank, "2000-01-01", `${salt}:reserva`);
}

/**
 * Prepara el contenido de una fecha: edición manual (si existe), selección del
 * banco (con variantes) o, como último recurso, el contenido de reserva.
 * Nunca devuelve contenido que no haya superado la validación.
 */
export function buildChallengeCandidate(dateKey: string): { candidate: Candidate; rejected: ValidationIssue[][] } {
  const env = serverEnv();
  const bank = getBank();
  const version = bankVersion(bank);
  const rejected: ValidationIssue[][] = [];

  const override = loadOverride(dateKey);
  if (override) {
    const issues = validateChallenge(override);
    if (issues.length === 0) {
      return {
        candidate: {
          source: "override",
          seed: `override-${dateKey}`,
          version: `override-${version}`,
          selection: { content: override, ...difficultyOf(override) },
        },
        rejected,
      };
    }
    rejected.push(issues);
  }

  for (let variant = 0; variant < 4; variant++) {
    const salt = variant === 0 ? env.challengeSalt : `${env.challengeSalt}:v${variant}`;
    try {
      const selection = selectChallengeContent(bank, dateKey, salt);
      const issues = validateChallenge(selection.content);
      if (issues.length === 0) {
        return {
          candidate: { source: "bank", seed: publicSeed(env.challengeSalt, dateKey, variant), version, selection },
          rejected,
        };
      }
      rejected.push(issues);
    } catch (error) {
      rejected.push([{ where: `variante ${variant}`, message: (error as Error).message }]);
    }
  }

  const reserve = reserveContent(bank, env.challengeSalt);
  const issues = validateChallenge(reserve.content);
  if (issues.length > 0) {
    throw new Error(`No hay contenido válido para ${dateKey}: ${JSON.stringify(issues.slice(0, 5))}`);
  }
  return { candidate: { source: "reserve", seed: `reserve-${dateKey}`, version, selection: reserve }, rejected };
}

const SELECT_CHALLENGE = `select id, challenge_date, public_id, content_version, difficulty, difficulty_score, source
  from daily_challenges where challenge_date = $1 and status = 'published'`;

async function insertQuestions(tx: Queryable, challengeId: string, content: ChallengeContent): Promise<void> {
  const rows: unknown[][] = [];
  const keys: QuestionSetKey[] = ["solo", "duel_a", "duel_b"];
  for (const key of keys) {
    const set = content[key];
    for (const phase of ["rosco", "quick", "clues", "saying", "link"] as const) {
      (set[phase] as ContentItem[]).forEach((item, position) => {
        const prompt = item.prompt;
        rows.push([
          challengeId,
          key,
          phase,
          position,
          prompt.kind === "rosco" ? prompt.letter : null,
          prompt.kind === "rosco" ? prompt.mode : null,
          JSON.stringify(prompt),
          item.answers,
          item.difficulty,
          item.id,
        ]);
      });
    }
  }
  const width = 10;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const placeholders = chunk
      .map((_, r) => `(${Array.from({ length: width }, (_, c) => `$${r * width + c + 1}`).join(", ")})`)
      .join(", ");
    await tx.query(
      `insert into daily_questions
        (challenge_id, set_key, phase, position, letter, letter_mode, prompt, answers, difficulty, bank_item_id)
       values ${placeholders}`,
      chunk.flat(),
    );
  }
}

/** Publica el desafío de una fecha si aún no existe (operación idempotente). */
export async function publishChallenge(
  db: Queryable & { transaction?: unknown },
  dateKey: string,
): Promise<ChallengeRecord> {
  if (!isDateKey(dateKey)) throw new Error(`Fecha no válida: ${dateKey}`);
  const existing = await db.query<ChallengeRow>(SELECT_CHALLENGE, [dateKey]);
  if (existing.rows[0]) return toRecord(existing.rows[0]);

  const { candidate } = buildChallengeCandidate(dateKey);
  const run = async (tx: Queryable) => {
    const inserted = await tx.query<{ id: string }>(
      `insert into daily_challenges
         (challenge_date, public_id, content_version, difficulty, difficulty_score, status, source, seed, published_at)
       values ($1, $2, $3, $4, $5, 'published', $6, $7, now())
       on conflict (challenge_date) do nothing
       returning id`,
      [
        dateKey,
        publicChallengeId(dateKey),
        candidate.version,
        candidate.selection.difficulty,
        candidate.selection.difficultyScore,
        candidate.source,
        candidate.seed,
      ],
    );
    const id = inserted.rows[0]?.id;
    if (id) await insertQuestions(tx, id, candidate.selection.content);
  };
  const withTx = db as unknown as { transaction?: <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T> };
  if (typeof withTx.transaction === "function") await withTx.transaction(run);
  else await run(db);

  const row = (await db.query<ChallengeRow>(SELECT_CHALLENGE, [dateKey])).rows[0];
  if (!row) throw new Error(`No se pudo publicar el desafío de ${dateKey}`);
  return toRecord(row);
}

/** Desafío de una fecha (lo publica en el primer acceso del día). */
export async function getChallengeForDate(db: Queryable, dateKey: string): Promise<ChallengeRecord> {
  const existing = await db.query<ChallengeRow>(SELECT_CHALLENGE, [dateKey]);
  if (existing.rows[0]) return toRecord(existing.rows[0]);
  return publishChallenge(db, dateKey);
}

export async function getChallengeById(db: Queryable, id: string): Promise<ChallengeRecord | null> {
  const res = await db.query<ChallengeRow>(
    `select id, challenge_date, public_id, content_version, difficulty, difficulty_score, source
       from daily_challenges where id = $1`,
    [id],
  );
  return res.rows[0] ? toRecord(res.rows[0]) : null;
}

interface QuestionRow {
  phase: StageKind;
  position: number;
  prompt: QuestionPrompt;
  answers: string[];
  difficulty: Difficulty;
  bank_item_id: string;
}

const setCache = new Map<string, QuestionSet>();

/** Preguntas de un jugador (con respuestas): uso exclusivo del servidor. */
export async function loadQuestionSet(
  db: Queryable,
  challengeId: string,
  setKey: QuestionSetKey,
): Promise<QuestionSet> {
  const cacheKey = `${challengeId}:${setKey}`;
  const cached = setCache.get(cacheKey);
  if (cached) return cached;
  const res = await db.query<QuestionRow>(
    `select phase, position, prompt, answers, difficulty, bank_item_id
       from daily_questions where challenge_id = $1 and set_key = $2
       order by phase, position`,
    [challengeId, setKey],
  );
  const set: QuestionSet = { rosco: [], quick: [], clues: [], saying: [], link: [] };
  for (const row of res.rows) {
    const item: ContentItem = {
      id: row.bank_item_id,
      prompt: row.prompt,
      answers: row.answers,
      difficulty: row.difficulty,
    };
    (set[row.phase] as ContentItem[])[row.position] = item;
  }
  if (set.rosco.length !== ALPHABET.length) throw new Error(`Desafío ${challengeId} incompleto (${setKey})`);
  if (setCache.size > 200) setCache.clear();
  setCache.set(cacheKey, set);
  return set;
}

export interface RoscoPreviewLetter {
  letter: string;
  mode: LetterMode;
}

/** Vista pública del rosco del día: solo letras y modos, nunca definiciones ni respuestas. */
export async function roscoPreview(db: Queryable, challengeId: string): Promise<RoscoPreviewLetter[]> {
  const res = await db.query<{ letter: string; letter_mode: LetterMode }>(
    `select letter, letter_mode from daily_questions
      where challenge_id = $1 and set_key = 'solo' and phase = 'rosco' order by position`,
    [challengeId],
  );
  return res.rows.map((r) => ({ letter: r.letter, mode: r.letter_mode }));
}
