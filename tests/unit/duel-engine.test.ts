import { describe, expect, it } from "vitest";
import { DEFAULT_TIMING } from "@/lib/game/config";
import {
  applyDuelAction,
  createDuelState,
  duelLine,
  duelRulesFor,
  playerRemainingMs,
  settleDuel,
  touchPlayer,
  type DuelState,
  type Seat,
} from "@/lib/game/duel-engine";
import type { QuestionSet } from "@/lib/game/content-types";
import { GameRuleError } from "@/lib/game/errors";
import { duelWinner } from "@/lib/game/ranking";
import { makeSet, roscoAnswer } from "../helpers/fixtures";

const content: Record<Seat, QuestionSet> = { 1: makeSet("aa"), 2: makeSet("bb") };
const T0 = 5_000_000;
const START = T0 + DEFAULT_TIMING.duelStartDelayMs;

function roscoDuel(): DuelState {
  return createDuelState(duelRulesFor("rosco", DEFAULT_TIMING), T0);
}

/** Mantiene a ambos jugadores «conectados» en el instante dado. */
function present(s: DuelState, now: number): DuelState {
  return touchPlayer(touchPlayer(s, 1, now), 2, now);
}

function cursorOf(s: DuelState, seat: Seat): number {
  return s.players[seat].rosco.cursor!;
}

describe("duelo: inicio", () => {
  it("asigna el primer turno de forma determinista y mantiene detenido el otro reloj", () => {
    const s = roscoDuel();
    expect(s.turnSeat).toBe(2); // empieza el invitado
    expect(s.turnStartedAt).toBe(START); // tras la cuenta atrás
    expect(playerRemainingMs(s, 2, START + 10_000)).toBe(170_000);
    expect(playerRemainingMs(s, 1, START + 10_000)).toBe(180_000);
  });

  it("rechaza respuestas durante la cuenta atrás", () => {
    const s = roscoDuel();
    expect(() => applyDuelAction(s, 2, { type: "pass", stage: 0, item: 0 }, content, T0 + 1000)).toThrow(
      /no ha empezado/,
    );
  });
});

describe("duelo: relojes y turnos", () => {
  it("Prueba A: tras un acierto el turno continúa y el reloj sigue corriendo", () => {
    let s = present(roscoDuel(), START);
    const r = applyDuelAction(
      s,
      2,
      { type: "answer", stage: 0, item: 0, text: roscoAnswer(content[2], 0) },
      content,
      START + 5_000,
    );
    s = r.state;
    expect(r.event.outcome).toBe("correct");
    expect(r.event.turnChanged).toBe(false);
    expect(s.turnSeat).toBe(2);
    expect(s.turnStartedAt).toBe(START); // el reloj no se ha reiniciado
    expect(playerRemainingMs(s, 2, START + 8_000)).toBe(172_000);
    expect(playerRemainingMs(s, 1, START + 8_000)).toBe(180_000); // rival detenido
  });

  it("Prueba B: tras un fallo se detiene el reloj propio y arranca el del rival", () => {
    let s = present(roscoDuel(), START);
    const r = applyDuelAction(s, 2, { type: "answer", stage: 0, item: 0, text: "mal" }, content, START + 7_000);
    s = r.state;
    expect(r.event.outcome).toBe("wrong");
    expect(r.event.turnChanged).toBe(true);
    expect(s.turnSeat).toBe(1);
    expect(s.players[2].bankMs).toBe(173_000);
    expect(s.turnStartedAt).toBe(START + 7_000);
    // Pasados 10 s: el reloj del que falló sigue parado, el del rival descuenta.
    expect(playerRemainingMs(s, 2, START + 17_000)).toBe(173_000);
    expect(playerRemainingMs(s, 1, START + 17_000)).toBe(170_000);
  });

  it("Prueba C: «Pasapalabra» congela el tiempo exacto y se recupera al volver el turno", () => {
    let s = present(roscoDuel(), START);
    // B (asiento 2) consume 68 s → le quedan 112 s y pulsa Pasapalabra.
    s = touchPlayer(s, 2, START + 40_000);
    s = applyDuelAction(s, 2, { type: "pass", stage: 0, item: 0 }, content, START + 68_000).state;
    expect(s.players[2].bankMs).toBe(112_000);
    expect(s.players[2].rosco.statuses[0]).toBe("passed");
    expect(s.turnSeat).toBe(1);
    // A juega 30 s y falla: el reloj de B vuelve a correr desde 112 s.
    const t1 = START + 98_000;
    s = present(s, t1);
    s = applyDuelAction(s, 1, { type: "answer", stage: 0, item: 0, text: "mal" }, content, t1).state;
    expect(s.players[1].bankMs).toBe(150_000);
    expect(s.turnSeat).toBe(2);
    expect(playerRemainingMs(s, 2, t1)).toBe(112_000);
    expect(playerRemainingMs(s, 2, t1 + 2_000)).toBe(110_000);
    // B sigue con su siguiente letra pendiente (la B), no repite la A.
    expect(cursorOf(s, 2)).toBe(1);
  });

  it("Prueba D: rechaza respuestas fuera de turno", () => {
    const s = present(roscoDuel(), START);
    expect(() =>
      applyDuelAction(
        s,
        1,
        { type: "answer", stage: 0, item: 0, text: roscoAnswer(content[1], 0) },
        content,
        START + 1000,
      ),
    ).toThrow(GameRuleError);
    try {
      applyDuelAction(s, 1, { type: "pass", stage: 0, item: 0 }, content, START + 1000);
    } catch (e) {
      expect((e as GameRuleError).code).toBe("not_your_turn");
    }
  });

  it("Prueba E: recalcular el estado (reconexión) no devuelve segundos ni duplica respuestas", () => {
    let s = present(roscoDuel(), START);
    s = applyDuelAction(
      s,
      2,
      { type: "answer", stage: 0, item: 0, text: roscoAnswer(content[2], 0) },
      content,
      START + 4_000,
    ).state;
    // El jugador recarga: el servidor vuelve a calcular a partir del estado persistido.
    const reloaded = settleDuel(JSON.parse(JSON.stringify(s)) as DuelState, START + 20_000).state;
    expect(playerRemainingMs(reloaded, 2, START + 20_000)).toBe(160_000);
    expect(reloaded.players[2].rosco.statuses[0]).toBe("correct");
    // Reenviar la misma respuesta a la misma letra se rechaza.
    expect(() =>
      applyDuelAction(
        reloaded,
        2,
        { type: "answer", stage: 0, item: 0, text: roscoAnswer(content[2], 0) },
        content,
        START + 20_000,
      ),
    ).toThrow(/ya no está activa/);
  });

  it("Prueba F: al agotarse el tiempo se bloquean las respuestas y el rival continúa con el suyo", () => {
    let s = present(roscoDuel(), START);
    // El asiento 2 deja correr su reloj completo sin responder (pero conectado).
    for (let t = 30_000; t <= 180_000; t += 30_000) s = touchPlayer(s, 2, START + t);
    const after = START + 180_500;
    s = touchPlayer(s, 1, after);
    s = settleDuel(s, after).state;
    expect(s.players[2].status).toBe("out_of_time");
    expect(s.players[2].bankMs).toBe(0);
    expect(s.turnSeat).toBe(1);
    expect(s.turnStartedAt).toBe(after);
    expect(() => applyDuelAction(s, 2, { type: "pass", stage: 0, item: 1 }, content, after + 10)).toThrow(
      GameRuleError,
    );
    // El rival sigue jugando con su propio banco de tiempo, también tras pasar.
    s = applyDuelAction(s, 1, { type: "pass", stage: 0, item: 0 }, content, after + 5_000).state;
    expect(s.turnSeat).toBe(1);
    expect(s.status).toBe("in_progress");
    expect(playerRemainingMs(s, 1, after + 5_000)).toBe(175_000);
  });

  it("los roscos son independientes", () => {
    let s = present(roscoDuel(), START);
    s = applyDuelAction(
      s,
      2,
      { type: "answer", stage: 0, item: 0, text: roscoAnswer(content[2], 0) },
      content,
      START + 1000,
    ).state;
    s = applyDuelAction(s, 2, { type: "pass", stage: 0, item: 1 }, content, START + 2000).state;
    expect(s.players[2].rosco.statuses.slice(0, 2)).toEqual(["correct", "passed"]);
    expect(s.players[1].rosco.statuses.slice(0, 2)).toEqual(["pending", "pending"]);
    expect(cursorOf(s, 1)).toBe(0);
    // La respuesta del asiento 2 no vale para el rosco del asiento 1 (preguntas distintas).
    s = present(s, START + 3000);
    const r = applyDuelAction(
      s,
      1,
      { type: "answer", stage: 0, item: 0, text: roscoAnswer(content[2], 0) },
      content,
      START + 3000,
    );
    expect(r.event.outcome).toBe("wrong");
  });

  it("termina cuando ambos han acabado y aplica el criterio de victoria", () => {
    let s = present(roscoDuel(), START);
    let now = START;
    // Asiento 2 acierta todo seguido.
    for (let i = 0; i < 27; i++) {
      s = applyDuelAction(
        s,
        2,
        { type: "answer", stage: 0, item: i, text: roscoAnswer(content[2], i) },
        content,
        (now += 500),
      ).state;
    }
    expect(s.players[2].status).toBe("finished");
    expect(s.turnSeat).toBe(1);
    // Asiento 1 falla todo.
    s = present(s, now);
    for (let i = 0; i < 27; i++) {
      s = applyDuelAction(s, 1, { type: "answer", stage: 0, item: i, text: "mal" }, content, (now += 200)).state;
      if (s.status !== "in_progress") break;
      expect(s.turnSeat).toBe(1); // el rival ya terminó: sigue jugando quien queda
    }
    expect(s.status).toBe("completed");
    expect(s.winnerSeat).toBe(2);
    expect(duelLine(s, 2).correct).toBe(27);
    expect(duelLine(s, 1).wrong).toBe(27);
  });

  it("declara abandono si el jugador activo no vuelve dentro del margen de reconexión", () => {
    let s = present(roscoDuel(), START);
    const grace = DEFAULT_TIMING.reconnectGraceMs;
    s = settleDuel(s, START + grace - 1).state;
    expect(s.status).toBe("in_progress");
    s = touchPlayer(s, 1, START + grace + 5);
    s = settleDuel(s, START + grace + 10).state;
    expect(s.status).toBe("abandoned");
    expect(s.winnerSeat).toBe(1);
    expect(s.turnSeat).toBeNull();
  });
});

describe("duelo: programa completo", () => {
  it("alterna turnos en las pruebas y suma los segundos ganados al rosco final", () => {
    let s = createDuelState(duelRulesFor("program", DEFAULT_TIMING), T0);
    expect(s.stages).toEqual(["quick", "clues", "saying", "link", "rosco"]);
    let now = START;
    s = present(s, now);
    // Palabras al vuelo: 3 elementos por jugador, turnos alternos (empieza el 2).
    const order: Seat[] = [];
    for (let k = 0; k < 6; k++) {
      const seat = s.turnSeat!;
      order.push(seat);
      const idx = s.players[seat].phases.quick.findIndex((i) => i.outcome === "pending");
      const text = seat === 2 ? content[2].quick[idx]!.answers[0]! : "mal";
      s = applyDuelAction(s, seat, { type: "answer", stage: 0, item: idx, text }, content, (now += 1000)).state;
    }
    expect(order).toEqual([2, 1, 2, 1, 2, 1]);
    expect(s.stageIndex).toBe(1);
    expect(s.players[2].bonusMs).toBe(9_000);
    expect(s.turnStartedAt).toBe(now + DEFAULT_TIMING.duelStageGapMs);
    // El resto de pruebas caducan por tiempo de jugada (jugadores conectados).
    for (let i = 0; i < 40 && s.stages[s.stageIndex] !== "rosco"; i++) {
      now += 41_000;
      s = present(s, now);
      s = settleDuel(s, now, content).state;
    }
    expect(s.stages[s.stageIndex]).toBe("rosco");
    expect(s.players[2].bankMs).toBe(120_000 + 9_000);
    expect(s.players[1].bankMs).toBe(120_000);
    // En El Rosco empieza quien tiene menos tiempo.
    expect(s.turnSeat).toBe(1);
  });

  it("criterio de desempate", () => {
    expect(duelWinner({ correct: 20, wrong: 3, timeUsedMs: 100_000 }, { correct: 19, wrong: 0, timeUsedMs: 1 })).toBe(
      1,
    );
    expect(
      duelWinner({ correct: 20, wrong: 3, timeUsedMs: 100_000 }, { correct: 20, wrong: 2, timeUsedMs: 170_000 }),
    ).toBe(2);
    expect(
      duelWinner({ correct: 20, wrong: 2, timeUsedMs: 100_000 }, { correct: 20, wrong: 2, timeUsedMs: 120_000 }),
    ).toBe(1);
    expect(
      duelWinner({ correct: 20, wrong: 2, timeUsedMs: 100_200 }, { correct: 20, wrong: 2, timeUsedMs: 99_900 }),
    ).toBeNull();
  });
});
