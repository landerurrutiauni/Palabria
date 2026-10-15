import { expect, type Page } from "@playwright/test";
import pg from "pg";

export const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

/** Lee las respuestas publicadas del día directamente de la base de datos (solo en pruebas). */
export async function answers(
  date: string,
  setKey: "solo" | "duel_a" | "duel_b",
  phase: "rosco" | "quick" | "clues" | "saying" | "link",
): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const res = await client.query<{ answer: string }>(
      `select q.answers[1] as answer from daily_questions q join daily_challenges c on c.id = q.challenge_id
        where c.challenge_date = $1 and q.set_key = $2 and q.phase = $3 order by q.position`,
      [date, setKey, phase],
    );
    return res.rows.map((r) => r.answer);
  } finally {
    await client.end();
  }
}

export async function answer(page: Page, text: string): Promise<void> {
  const input = page.getByLabel("Tu respuesta");
  await expect(input).toBeEnabled();
  await input.fill(text);
  await input.press("Enter");
}

export function clockSeconds(text: string | null): number {
  const m = /(\d+):(\d{2})/.exec(text ?? "");
  if (!m) throw new Error(`Reloj no reconocido: ${text}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Letra de un rosco concreto (por su etiqueta accesible). */
export function letter(page: Page, roscoLabel: string, l: string) {
  return page.getByRole("list", { name: roscoLabel }).first().getByRole("listitem", { name: new RegExp(`^${l}:`) });
}

export async function today(page: Page): Promise<string> {
  const res = await page.request.get("/api/challenge");
  return ((await res.json()) as { date: string }).date;
}
