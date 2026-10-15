import { describe, expect, it } from "vitest";
import { DEFAULT_TIMING } from "@/lib/game/config";
import { GameRuleError } from "@/lib/game/errors";
import {
  applySoloAction,
  createSoloState,
  settleSolo,
  soloRulesFor,
  soloSummary,
  type SoloState,
} from "@/lib/game/solo-engine";
import { makeSet, roscoAnswer } from "../helpers/fixtures";

const set = makeSet("uno");
const T0 = 1_000_000;

function roscoGame(): SoloState {
  return createSoloState(soloRulesFor("rosco", DEFAULT_TIMING), T0);
}

describe("modo individual: solo El Rosco", () => {
  it("valida aciertos, registra fallos y permite pasar letras", () => {
    let s = roscoGame();
    let r = applySoloAction(
      s,
      { type: "answer", stage: 0, item: 0, text: roscoAnswer(set, 0).toUpperCase() },
      set,
      T0 + 1000,
    );
    expect(r.event.outcome).toBe("correct");
    s = r.state;
    r = applySoloAction(s, { type: "answer", stage: 0, item: 1, text: "incorrecta" }, set, T0 + 2000);
    expect(r.event.outcome).toBe("wrong");
    expect(r.event.revealedAnswer).toBe(roscoAnswer(set, 1));
    s = r.state;
    r = applySoloAction(s, { type: "pass", stage: 0, item: 2 }, set, T0 + 3000);
    expect(r.event.outcome).toBe("passed");
    expect(r.event.revealedAnswer).toBeNull(); // no se revela una letra pendiente
    s = r.state;
    const rosco = s.stages[0]!.rosco!;
    expect(rosco.statuses.slice(0, 3)).toEqual(["correct", "wrong", "passed"]);
    expect(rosco.cursor).toBe(3);
  });

  it("recupera las letras pasadas en la siguiente vuelta y termina al resolverlas todas", () => {
    let s = roscoGame();
    for (let i = 0; i < 27; i++) {
      s = applySoloAction(s, { type: "pass", stage: 0, item: i }, set, T0 + 100 * i).state;
    }
    expect(s.stages[0]!.rosco!.cursor).toBe(0);
    for (let i = 0; i < 27; i++) {
      s = applySoloAction(
        s,
        { type: "answer", stage: 0, item: i, text: roscoAnswer(set, i) },
        set,
        T0 + 10_000 + i,
      ).state;
    }
    expect(s.status).toBe("completed");
    const sum = soloSummary(s, T0 + 20_000);
    expect(sum.rosco.correct).toBe(27);
    expect(sum.perfect).toBe(true);
    expect(sum.roscoComplete).toBe(true);
    // 27 aciertos · 10 + segundos sobrantes
    expect(sum.score).toBe(270 + Math.floor((180_000 - 10_026) / 1000));
  });

  it("termina al agotarse el tiempo y no cuenta las letras sin resolver como aciertos", () => {
    let s = roscoGame();
    s = applySoloAction(s, { type: "answer", stage: 0, item: 0, text: roscoAnswer(set, 0) }, set, T0 + 1000).state;
    const settled = settleSolo(s, T0 + 180_001).state;
    expect(settled.status).toBe("completed");
    expect(settled.stages[0]!.endReason).toBe("timeout");
    expect(settled.finishedAt).toBe(T0 + 180_000);
    const sum = soloSummary(settled, T0 + 200_000);
    expect(sum.rosco.correct).toBe(1);
    expect(sum.rosco.open).toBe(26);
    expect(sum.roscoTimeUsedMs).toBe(180_000);
    expect(() =>
      applySoloAction(settled, { type: "answer", stage: 0, item: 1, text: roscoAnswer(set, 1) }, set, T0 + 200_000),
    ).toThrow(GameRuleError);
  });

  it("rechaza respuestas repetidas a una letra ya resuelta (reenvíos)", () => {
    let s = roscoGame();
    s = applySoloAction(s, { type: "answer", stage: 0, item: 0, text: roscoAnswer(set, 0) }, set, T0 + 1000).state;
    expect(() =>
      applySoloAction(s, { type: "answer", stage: 0, item: 0, text: roscoAnswer(set, 0) }, set, T0 + 1100),
    ).toThrow(/ya no está activa/);
  });

  it("el reloj no se reinicia: el tiempo restante depende solo del inicio guardado", () => {
    const s = roscoGame();
    const later = settleSolo(s, T0 + 90_000).state;
    expect(later.status).toBe("in_progress");
    expect(later.stages[0]!.startedAt).toBe(T0);
    expect(soloSummary(later, T0 + 90_000).roscoRemainingMs).toBe(90_000);
  });
});

describe("modo individual: programa completo", () => {
  function program(): SoloState {
    return createSoloState(soloRulesFor("program", DEFAULT_TIMING), T0);
  }

  it("recorre las cuatro pruebas y termina con El Rosco con los segundos ganados", () => {
    let s = program();
    expect(s.stages.map((x) => x.kind)).toEqual(["quick", "clues", "saying", "link", "rosco"]);
    let now = T0;
    // Palabras al vuelo: 6 aciertos (+60 puntos, +18 s)
    for (let i = 0; i < 6; i++) {
      s = applySoloAction(
        s,
        { type: "answer", stage: 0, item: i, text: set.quick[i]!.answers[0]! },
        set,
        (now += 1000),
      ).state;
    }
    expect(s.stageIndex).toBe(1);
    expect(s.stages[1]!.status).toBe("ready");
    // Entreacto: el reloj no corre hasta empezar la prueba.
    now += 60_000;
    s = applySoloAction(s, { type: "start_stage", stage: 1 }, set, now).state;
    // La pista justa: pide una pista y acierta (30 puntos), luego falla la segunda palabra.
    s = applySoloAction(s, { type: "clue", stage: 1, item: 0 }, set, (now += 1000)).state;
    s = applySoloAction(
      s,
      { type: "answer", stage: 1, item: 0, text: set.clues[0]!.answers[0]! },
      set,
      (now += 1000),
    ).state;
    s = applySoloAction(s, { type: "answer", stage: 1, item: 1, text: "nada" }, set, (now += 1000)).state;
    expect(s.stages[1]!.items.map((i) => i.points)).toEqual([30, 0]);
    // Dichos y hechos: pasa todo
    s = applySoloAction(s, { type: "start_stage", stage: 2 }, set, (now += 1000)).state;
    for (let i = 0; i < 5; i++) s = applySoloAction(s, { type: "pass", stage: 2, item: i }, set, (now += 100)).state;
    // El eslabón: se agota el tiempo
    s = applySoloAction(s, { type: "start_stage", stage: 3 }, set, (now += 1000)).state;
    const linkStart = now;
    s = settleSolo(s, linkStart + 75_001).state;
    expect(s.stages[3]!.endReason).toBe("timeout");
    expect(s.stages[3]!.items.every((i) => i.outcome === "timeout")).toBe(true);
    expect(s.stageIndex).toBe(4);
    now = linkStart + 80_000;
    s = applySoloAction(s, { type: "start_stage", stage: 4 }, set, now).state;
    // Rosco: 120 s base + 18 s (6×3) + 6 s (pista con 2 pistas vistas)
    expect(s.stages[4]!.timeLimitMs).toBe(120_000 + 18_000 + 6_000);
    s = settleSolo(s, now + 200_000).state;
    expect(s.status).toBe("completed");
    const sum = soloSummary(s, now + 200_000);
    expect(sum.phasePoints).toBe(60 + 30);
    expect(sum.score).toBe(90);
  });

  it("abandona el programa si no se continúa durante el entreacto", () => {
    let s = program();
    s = settleSolo(s, T0 + 60_000).state; // fin de la primera prueba
    expect(s.stages[1]!.status).toBe("ready");
    s = settleSolo(s, T0 + 60_000 + DEFAULT_TIMING.intermissionTimeoutMs + 1).state;
    expect(s.status).toBe("abandoned");
  });

  it("no permite empezar una prueba que no toca", () => {
    const s = program();
    expect(() => applySoloAction(s, { type: "start_stage", stage: 1 }, set, T0 + 10)).toThrow(GameRuleError);
  });
});
