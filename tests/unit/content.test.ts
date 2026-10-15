import { describe, expect, it } from "vitest";
import { getBank } from "@/content/bank";
import { ALPHABET } from "@/lib/game/alphabet";
import { addDays } from "@/lib/game/daily";
import { normalizeAnswer } from "@/lib/game/normalize";
import { selectChallengeContent } from "@/lib/content/select";
import { textRevealsAnswer, validateBank, validateChallenge, validateItem } from "@/lib/content/validate";

const bank = getBank();
const SALT = "test-salt";

describe("banco de preguntas", () => {
  it("supera la validación automática", () => {
    const issues = validateBank(bank as unknown as Record<string, never[]>);
    expect(issues).toEqual([]);
  });

  it("tiene al menos tres definiciones por cada una de las 27 letras", () => {
    for (const letter of ALPHABET) {
      const count = bank.rosco.filter((i) => i.prompt.letter === letter).length;
      expect(count, `letra ${letter}`).toBeGreaterThanOrEqual(15);
    }
  });

  it("detecta errores de letra y respuestas reveladas", () => {
    const bad = validateItem({
      id: "x",
      prompt: { kind: "rosco", letter: "Ñ", mode: "starts", definition: "Animal parecido al nandu que corre mucho." },
      answers: ["nandu"],
      difficulty: 2,
    });
    expect(bad.some((i) => i.message.includes("no empieza por la Ñ"))).toBe(true);
    expect(bad.some((i) => i.message.includes("revela"))).toBe(true);
    expect(textRevealsAnswer("Mamífero de los bueyes", "buey")).toBe(true);
    expect(textRevealsAnswer("Agua en estado sólido", "sol")).toBe(false);
  });
});

describe("selección diaria", () => {
  it("es estable para una misma fecha y válida", () => {
    const a = selectChallengeContent(bank, "2026-10-15", SALT);
    const b = selectChallengeContent(bank, "2026-10-15", SALT);
    expect(a).toEqual(b);
    expect(validateChallenge(a.content)).toEqual([]);
    expect(a.content.solo.rosco.map((i) => i.prompt.letter)).toEqual([...ALPHABET]);
  });

  it("cambia de verdad cada día y genera desafíos válidos durante semanas", () => {
    let previous: string[] = [];
    const seenSolo = new Set<string>();
    let total = 0;
    for (let d = 0; d < 21; d++) {
      const date = addDays("2026-10-15", d);
      const { content } = selectChallengeContent(bank, date, SALT);
      expect(validateChallenge(content), date).toEqual([]);
      const ids = content.solo.rosco.map((i) => i.id);
      const overlap = ids.filter((id) => previous.includes(id)).length;
      expect(overlap, `${date} repite demasiadas preguntas del día anterior`).toBeLessThan(4);
      previous = ids;
      ids.forEach((id) => seenSolo.add(id));
      total += ids.length;
    }
    // A lo largo de tres semanas se usa una parte amplia del banco.
    expect(seenSolo.size / total).toBeGreaterThan(0.55);
  });

  it("empareja roscos de duelo equivalentes y distintos entre sí", () => {
    const { content } = selectChallengeContent(bank, "2026-11-02", SALT);
    const sumA = content.duel_a.rosco.reduce((s, i) => s + i.difficulty, 0);
    const sumB = content.duel_b.rosco.reduce((s, i) => s + i.difficulty, 0);
    expect(Math.abs(sumA - sumB)).toBeLessThanOrEqual(4);
    const answersA = new Set(content.duel_a.rosco.map((i) => normalizeAnswer(i.answers[0]!)));
    expect(content.duel_b.rosco.some((i) => answersA.has(normalizeAnswer(i.answers[0]!)))).toBe(false);
    const sameMode = content.duel_a.rosco.filter(
      (i, idx) => i.prompt.mode === content.duel_b.rosco[idx]!.prompt.mode,
    ).length;
    expect(sameMode).toBeGreaterThanOrEqual(25);
  });
});
