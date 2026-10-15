import { describe, expect, it } from "vitest";
import { elapsedSince, formatClock, remainingMs, stopClock } from "@/lib/game/clock";
import {
  addDays,
  challengeDateKey,
  isDateKey,
  madridOffsetMs,
  nextChallengeStart,
  startOfChallengeDay,
} from "@/lib/game/daily";
import { applyRoscoOutcome, createRosco, letterVisualState, nextOpenIndex, roscoCounts } from "@/lib/game/rosco";
import { roscoPoints } from "@/lib/game/scoring";

describe("rosco", () => {
  it("recorre las letras en orden y vuelve a las pasadas", () => {
    let r = createRosco(5);
    r = applyRoscoOutcome(r, 0, "correct");
    expect(r.cursor).toBe(1);
    r = applyRoscoOutcome(r, 1, "passed");
    expect(r.cursor).toBe(2);
    r = applyRoscoOutcome(r, 2, "wrong");
    r = applyRoscoOutcome(r, 3, "passed");
    r = applyRoscoOutcome(r, 4, "correct");
    // Segunda vuelta: vuelve a la B (pasada) y después a la D.
    expect(r.cursor).toBe(1);
    r = applyRoscoOutcome(r, 1, "correct");
    expect(r.cursor).toBe(3);
    r = applyRoscoOutcome(r, 3, "passed");
    expect(r.cursor).toBe(3); // única letra abierta: se vuelve a preguntar
    r = applyRoscoOutcome(r, 3, "wrong");
    expect(r.cursor).toBeNull();
    expect(roscoCounts(r)).toMatchObject({ correct: 3, wrong: 2, open: 0 });
  });

  it("no permite responder una letra que no es la activa ni una ya resuelta", () => {
    const r = createRosco(3);
    expect(() => applyRoscoOutcome(r, 1, "correct")).toThrow();
    const r2 = applyRoscoOutcome(r, 0, "correct");
    expect(() => applyRoscoOutcome({ ...r2, cursor: 0 }, 0, "correct")).toThrow();
  });

  it("deriva los estados visuales, incluido «no jugada» al terminar", () => {
    let r = createRosco(3);
    r = applyRoscoOutcome(r, 0, "passed");
    expect(letterVisualState(r, 0, false)).toBe("passed");
    expect(letterVisualState(r, 1, false)).toBe("active");
    expect(letterVisualState(r, 2, false)).toBe("pending");
    expect(letterVisualState(r, 0, true)).toBe("unplayed");
    expect(nextOpenIndex(r.statuses, 2)).toBe(0);
  });

  it("puntúa aciertos, fallos y bonificación de tiempo", () => {
    expect(roscoPoints({ correct: 20, wrong: 4, open: 3, remainingMs: 50_000 })).toBe(180);
    expect(roscoPoints({ correct: 25, wrong: 2, open: 0, remainingMs: 12_400 })).toBe(252);
    expect(roscoPoints({ correct: 0, wrong: 6, open: 21, remainingMs: 0 })).toBe(0);
  });
});

describe("reloj basado en marcas de tiempo", () => {
  it("calcula el tiempo restante sin contadores", () => {
    expect(remainingMs(180_000, 1_000, 61_000)).toBe(120_000);
    expect(remainingMs(180_000, null, 999_999)).toBe(180_000);
    expect(remainingMs(10_000, 0, 50_000)).toBe(0);
    expect(stopClock(112_000, 5_000, 5_000)).toBe(112_000);
    // Cuenta atrás: un inicio futuro no consume tiempo.
    expect(elapsedSince(10_000, 5_000)).toBe(0);
    expect(formatClock(112_000)).toBe("1:52");
    expect(formatClock(400)).toBe("0:01");
  });
});

describe("fecha oficial en Europe/Madrid", () => {
  it("cambia de día a medianoche de Madrid en invierno (UTC+1)", () => {
    // 15/01/2026 22:59:59 UTC = 23:59:59 en Madrid
    expect(challengeDateKey(Date.UTC(2026, 0, 15, 22, 59, 59))).toBe("2026-01-15");
    expect(challengeDateKey(Date.UTC(2026, 0, 15, 23, 0, 0))).toBe("2026-01-16");
    expect(madridOffsetMs(Date.UTC(2026, 0, 15, 12))).toBe(3_600_000);
  });

  it("cambia de día a medianoche de Madrid en verano (UTC+2)", () => {
    expect(challengeDateKey(Date.UTC(2026, 6, 10, 21, 59, 59))).toBe("2026-07-10");
    expect(challengeDateKey(Date.UTC(2026, 6, 10, 22, 0, 0))).toBe("2026-07-11");
    expect(madridOffsetMs(Date.UTC(2026, 6, 10, 12))).toBe(7_200_000);
  });

  it("calcula la próxima medianoche alrededor de los cambios de hora", () => {
    // Cambio a horario de verano: domingo 29/03/2026 a las 02:00 → 03:00.
    expect(startOfChallengeDay("2026-03-29")).toBe(Date.UTC(2026, 2, 28, 23));
    expect(startOfChallengeDay("2026-03-30")).toBe(Date.UTC(2026, 2, 29, 22));
    // Cambio a horario de invierno: domingo 25/10/2026 a las 03:00 → 02:00.
    expect(startOfChallengeDay("2026-10-25")).toBe(Date.UTC(2026, 9, 24, 22));
    expect(startOfChallengeDay("2026-10-26")).toBe(Date.UTC(2026, 9, 25, 23));
    expect(nextChallengeStart(Date.UTC(2026, 9, 25, 12))).toBe(Date.UTC(2026, 9, 25, 23));
    // El día del cambio de invierno dura 25 horas.
    expect(startOfChallengeDay("2026-10-26") - startOfChallengeDay("2026-10-25")).toBe(25 * 3_600_000);
  });

  it("valida y suma fechas", () => {
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(isDateKey("2026-1-01")).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
