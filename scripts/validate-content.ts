/**
 * Valida el banco de preguntas y simula la selección de los próximos días.
 * Uso: npm run content:validate [-- --days 60]
 * Sale con código 1 si encuentra cualquier problema.
 */
import { getBank } from "@/content/bank";
import { reserveContent } from "@/lib/server/challenges";
import { selectChallengeContent } from "@/lib/content/select";
import { validateBank, validateChallenge } from "@/lib/content/validate";
import { addDays, challengeDateKey } from "@/lib/game/daily";
import { ALPHABET } from "@/lib/game/alphabet";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const bank = getBank();
const days = Number(arg("days", "45"));
const salt = process.env.CHALLENGE_SALT ?? "palabria-default-salt";
let failures = 0;

const bankIssues = validateBank(bank as unknown as Record<string, never[]>);
for (const issue of bankIssues) console.error(`✗ banco ${issue.where}: ${issue.message}`);
failures += bankIssues.length;

const perLetter = ALPHABET.map((l) => `${l}:${bank.rosco.filter((i) => i.prompt.letter === l).length}`).join(" ");
console.log(`Banco: ${bank.rosco.length} definiciones de rosco (${perLetter})`);
console.log(`Pruebas: ${bank.quick.length} rápidas · ${bank.clues.length} pistas · ${bank.saying.length} dichos · ${bank.link.length} eslabones`);

const reserve = reserveContent(bank, salt);
const reserveIssues = validateChallenge(reserve.content);
for (const issue of reserveIssues) console.error(`✗ reserva ${issue.where}: ${issue.message}`);
failures += reserveIssues.length;

const start = challengeDateKey(Date.now());
for (let d = 0; d < days; d++) {
  const date = addDays(start, d);
  try {
    const { content } = selectChallengeContent(bank, date, salt);
    const issues = validateChallenge(content);
    for (const issue of issues) console.error(`✗ ${date} ${issue.where}: ${issue.message}`);
    failures += issues.length;
  } catch (error) {
    console.error(`✗ ${date}: ${(error as Error).message}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} problema(s) encontrados.`);
  process.exit(1);
}
console.log(`✓ Banco válido, contenido de reserva válido y ${days} días simulados sin errores (desde ${start}).`);
