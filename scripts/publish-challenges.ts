/**
 * Publica por adelantado los desafíos de los próximos días (quedan fijados en
 * la base de datos y ya no cambian aunque se edite el banco).
 * Uso: npm run challenges:publish [-- --days 7] [-- --from 2026-10-20]
 */
import { publishChallenge } from "@/lib/server/challenges";
import { openDatabase } from "@/lib/server/db";
import { serverNow } from "@/lib/server/clock";
import { addDays, challengeDateKey, isDateKey } from "@/lib/game/daily";
import { difficultyLabel } from "@/lib/content/select";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const db = await openDatabase();
  try {
    const days = Number(arg("days") ?? "7");
    const from = arg("from") ?? challengeDateKey(await serverNow(db));
    if (!isDateKey(from)) throw new Error(`Fecha no válida: ${from}`);
    for (let d = 0; d < days; d++) {
      const date = addDays(from, d);
      const c = await publishChallenge(db, date);
      console.log(
        `${date}  ${c.publicId}  ${difficultyLabel(c.difficulty).padEnd(7)}  ${c.source.padEnd(8)}  ${c.contentVersion}`,
      );
    }
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
