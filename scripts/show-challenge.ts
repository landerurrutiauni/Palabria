/**
 * Muestra el contenido de un desafío para revisarlo a mano.
 *   npm run challenges:show -- --date 2026-10-20          (publicado o, si no lo está, vista previa)
 *   npm run challenges:show -- --date 2026-10-20 --json   (formato de edición manual)
 * Para corregir un día aún no publicado: guarda la salida --json en
 * content/overrides/<fecha>.json, edítala y valida con `npm run content:validate`.
 */
import { buildChallengeCandidate, getChallengeById, loadQuestionSet } from "@/lib/server/challenges";
import { openDatabase } from "@/lib/server/db";
import { serverNow } from "@/lib/server/clock";
import { challengeDateKey, isDateKey } from "@/lib/game/daily";
import { letterModeLabel } from "@/lib/game/alphabet";
import type { ChallengeContent, ContentItem } from "@/lib/game/content-types";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function describe(item: ContentItem): string {
  const p = item.prompt;
  switch (p.kind) {
    case "rosco":
      return `${p.letter} · ${letterModeLabel(p.mode)} ${p.letter}: ${p.definition}`;
    case "quick":
      return p.definition;
    case "clues":
      return p.clues.join(" / ");
    case "saying":
      return p.text;
    case "link":
      return p.words.join(" · ");
  }
}

async function main() {
  const db = await openDatabase();
  try {
    const date = arg("date") ?? challengeDateKey(await serverNow(db));
    if (!isDateKey(date)) throw new Error(`Fecha no válida: ${date}`);
    const row = await db.query<{ id: string }>("select id from daily_challenges where challenge_date = $1", [date]);
    let content: ChallengeContent;
    let label: string;
    if (row.rows[0]) {
      const c = (await getChallengeById(db, row.rows[0].id))!;
      content = {
        solo: await loadQuestionSet(db, c.id, "solo"),
        duel_a: await loadQuestionSet(db, c.id, "duel_a"),
        duel_b: await loadQuestionSet(db, c.id, "duel_b"),
      };
      label = `publicado (${c.publicId}, ${c.source}, ${c.contentVersion})`;
    } else {
      const { candidate } = buildChallengeCandidate(date);
      content = candidate.selection.content;
      label = `vista previa sin publicar (${candidate.source})`;
    }
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(content, null, 2));
      return;
    }
    console.log(`Desafío del ${date} — ${label}\n`);
    for (const key of ["solo", "duel_a", "duel_b"] as const) {
      console.log(`══ ${key} ══`);
      for (const phase of ["quick", "clues", "saying", "link", "rosco"] as const) {
        for (const item of content[key][phase] as ContentItem[]) {
          console.log(`  [${phase}] ${describe(item)}  →  ${item.answers.join(" | ")}  (dif. ${item.difficulty})`);
        }
      }
    }
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
