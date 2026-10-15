import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getChallengeForDate, loadQuestionSet } from "@/lib/server/challenges";
import type { Database } from "@/lib/server/db";
import {
  createRoom,
  getRoomView,
  joinRoom,
  leaveRoom,
  roomAction,
  setReady,
  setVoice,
  sweepRooms,
} from "@/lib/server/room-service";
import { getMe } from "@/lib/server/stats-service";
import type { QuestionSet } from "@/lib/game/content-types";
import type { DuelView } from "@/lib/views";
import { FakeClock, newPlayer, openTestDatabase, resetDatabase } from "../helpers/db";

let db: Database;
const T0 = Date.UTC(2026, 9, 15, 10, 0, 0);
const clock = new FakeClock(T0);

beforeAll(async () => {
  db = await openTestDatabase();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await resetDatabase(db);
  clock.now = T0;
  clock.install();
});

async function sets(date: string): Promise<{ 1: QuestionSet; 2: QuestionSet }> {
  const c = await getChallengeForDate(db, date);
  return { 1: await loadQuestionSet(db, c.id, "duel_a"), 2: await loadQuestionSet(db, c.id, "duel_b") };
}

function remaining(view: DuelView, seat: 1 | 2): number {
  const p = view.players[seat]!;
  if (!p.running || view.turn.startedAt === null) return p.bankMs;
  return Math.max(0, p.bankMs - (view.serverNow - view.turn.startedAt));
}

async function startedDuel(mode: "rosco" | "program" = "rosco") {
  const host = await newPlayer(db);
  const guest = await newPlayer(db);
  const { code } = await createRoom(host, mode, db);
  return { host, guest, code };
}

describe("salas 1 vs 1", () => {
  it("crear una sala no consume el intento; empezar consume el de ambos de forma atómica", async () => {
    const { host, guest, code } = await startedDuel();
    expect((await getMe(db, host)).attempts.duel.used).toBe(false);

    // El invitado ve la invitación sin cuentas ni registro.
    const invite = await getRoomView(guest, code, db);
    expect(invite.view).toMatchObject({ status: "waiting", you: null, canJoin: true, hostName: host.displayName });

    // La misma identidad no puede ser su propio rival.
    await expect(joinRoom(host, code, db)).rejects.toMatchObject({ code: "own_room" });

    await joinRoom(guest, code, db);
    let view = (await getRoomView(host, code, db)).view;
    expect(view.status).toBe("ready");
    expect((await getMe(db, guest)).attempts.duel.used).toBe(false);

    await setReady(host, code, true, db);
    view = (await getRoomView(host, code, db)).view;
    expect(view.status).toBe("in_progress");
    expect((await getMe(db, host)).attempts.duel.used).toBe(true);
    expect((await getMe(db, guest)).attempts.duel.used).toBe(true);

    // Un tercero no puede entrar en una sala privada completa.
    const intruder = await newPlayer(db);
    await expect(getRoomView(intruder, code, db)).rejects.toMatchObject({ code: "room_full" });
    await expect(joinRoom(intruder, code, db)).rejects.toMatchObject({ code: "room_full" });

    // Tras jugar, no se puede crear otra sala ese día.
    await expect(createRoom(host, "rosco", db)).rejects.toMatchObject({ code: "duel_attempt_used" });
  });

  it("turnos y relojes: acierto continúa, fallo y Palabria ceden el turno, fuera de turno se rechaza", async () => {
    const { host, guest, code } = await startedDuel();
    await joinRoom(guest, code, db);
    await setReady(host, code, true, db);
    const s = await sets("2026-10-15");
    let gv = (await getRoomView(guest, code, db)).view;
    expect(gv.turn.seat).toBe(2); // empieza el invitado
    expect(gv.prompt).toMatchObject({ kind: "rosco", letter: "A" });
    let hv = (await getRoomView(host, code, db)).view;
    expect(hv.prompt).toBeNull(); // el anfitrión no ve preguntas fuera de su turno

    // Cuenta atrás: respuestas antes de tiempo rechazadas.
    await expect(
      roomAction(guest, code, { actionId: randomUUID(), action: { type: "pass", stage: 0, item: 0 } }, db),
    ).rejects.toMatchObject({ code: "not_started" });
    clock.advance(3_500);

    // Prueba D: fuera de turno.
    await expect(
      roomAction(
        host,
        code,
        { actionId: randomUUID(), action: { type: "answer", stage: 0, item: 0, text: s[1].rosco[0]!.answers[0]! } },
        db,
      ),
    ).rejects.toMatchObject({ code: "not_your_turn" });

    // Prueba A: acierto → sigue el turno y el reloj.
    clock.advance(5_000);
    let r = await roomAction(
      guest,
      code,
      { actionId: randomUUID(), action: { type: "answer", stage: 0, item: 0, text: s[2].rosco[0]!.answers[0]! } },
      db,
    );
    expect(r.feedback?.outcome).toBe("correct");
    expect(r.view.turn.seat).toBe(2);
    expect(remaining(r.view, 2)).toBe(175_000);
    expect(r.view.players[1]!.running).toBe(false);

    // Prueba C: Palabria con 112 s → se congela y arranca el rival.
    clock.advance(63_000);
    await getRoomView(guest, code, db); // latido de presencia
    r = await roomAction(guest, code, { actionId: randomUUID(), action: { type: "pass", stage: 0, item: 1 } }, db);
    expect(r.view.turn.seat).toBe(1);
    expect(r.view.players[2]!.bankMs).toBe(112_000);
    expect(r.view.players[2]!.running).toBe(false);
    hv = (await getRoomView(host, code, db)).view;
    expect(hv.players[1]!.running).toBe(true);
    expect(hv.prompt).toMatchObject({ kind: "rosco", letter: "A" });

    // Prueba B: el anfitrión falla tras 20 s → su reloj se para en 160 s y vuelve el del invitado.
    clock.advance(20_000);
    r = await roomAction(
      host,
      code,
      { actionId: randomUUID(), action: { type: "answer", stage: 0, item: 0, text: "nada" } },
      db,
    );
    expect(r.feedback).toMatchObject({ outcome: "wrong", answer: s[1].rosco[0]!.answers[0] });
    expect(r.view.players[1]!.bankMs).toBe(160_000);
    expect(r.view.turn.seat).toBe(2);
    clock.advance(2_000);
    gv = (await getRoomView(guest, code, db)).view;
    expect(remaining(gv, 2)).toBe(110_000); // retoma desde 112 s, no desde el inicio
    expect(gv.prompt).toMatchObject({ kind: "rosco", letter: "C" }); // siguiente pendiente propia
    // El rival solo ve estados de letras, nunca la solución de la letra fallada.
    expect(JSON.stringify(gv)).not.toContain(s[1].rosco[0]!.answers[0]!);
    expect(gv.players[1]!.letters[0]!.state).toBe("wrong");

    // Prueba E: recarga del jugador activo → mismo turno, mismo reloj, sin duplicados.
    const actionId = randomUUID();
    clock.advance(1_000);
    r = await roomAction(
      guest,
      code,
      { actionId, action: { type: "answer", stage: 0, item: 2, text: s[2].rosco[2]!.answers[0]! } },
      db,
    );
    const dup = await roomAction(
      guest,
      code,
      { actionId, action: { type: "answer", stage: 0, item: 2, text: s[2].rosco[2]!.answers[0]! } },
      db,
    );
    expect(dup.duplicate).toBe(true);
    expect(dup.view.players[2]!.correct).toBe(2);
    const reload = (await getRoomView(guest, code, db)).view;
    expect(reload.turn).toEqual(r.view.turn);
    expect(reload.players[2]!.correct).toBe(2);
  });

  it("Prueba F: al agotarse el tiempo se bloquean sus respuestas y el rival sigue; al final se guarda el resultado", async () => {
    const { host, guest, code } = await startedDuel();
    await joinRoom(guest, code, db);
    await setReady(host, code, true, db);
    const s = await sets("2026-10-15");
    clock.advance(3_500);
    // El invitado deja correr su reloj (conectado) hasta agotarlo.
    for (let t = 0; t < 6; t++) {
      clock.advance(30_000);
      await getRoomView(guest, code, db);
      await getRoomView(host, code, db);
    }
    clock.advance(1_000);
    const view = (await getRoomView(host, code, db)).view;
    expect(view.players[2]!.status).toBe("out_of_time");
    expect(view.players[2]!.bankMs).toBe(0);
    expect(view.turn.seat).toBe(1);
    await expect(
      roomAction(guest, code, { actionId: randomUUID(), action: { type: "pass", stage: 0, item: 0 } }, db),
    ).rejects.toMatchObject({ status: 409, code: "not_your_turn" });
    // El anfitrión acierta dos y pasa: sigue jugando porque el rival ya no puede.
    let r = await roomAction(
      host,
      code,
      { actionId: randomUUID(), action: { type: "answer", stage: 0, item: 0, text: s[1].rosco[0]!.answers[0]! } },
      db,
    );
    r = await roomAction(host, code, { actionId: randomUUID(), action: { type: "pass", stage: 0, item: 1 } }, db);
    expect(r.view.turn.seat).toBe(1);
    // Se agota también su tiempo → partida terminada y resultados guardados.
    for (let t = 0; t < 7; t++) {
      clock.advance(30_000);
      await getRoomView(host, code, db);
    }
    const end = (await getRoomView(host, code, db)).view;
    expect(end.status).toBe("completed");
    expect(end.result?.outcome).toBe("win");
    expect(end.result?.rival?.letters).toHaveLength(27);
    const guestEnd = (await getRoomView(guest, code, db)).view;
    expect(guestEnd.result?.outcome).toBe("loss");
    const outcomes = await db.query<{ player_id: string; outcome: string }>(
      "select player_id, outcome from game_results where kind = 'duel'",
    );
    expect(outcomes.rows.find((r) => r.player_id === host.id)?.outcome).toBe("win");
    expect(outcomes.rows.find((r) => r.player_id === guest.id)?.outcome).toBe("loss");
    const n = await db.query<{ n: number }>("select count(*)::int as n from game_results where kind = 'duel'");
    expect(n.rows[0]!.n).toBe(2);
  });

  it("abandono: si el jugador activo no vuelve dentro del margen, pierde la partida", async () => {
    const { host, guest, code } = await startedDuel();
    await joinRoom(guest, code, db);
    await setReady(host, code, true, db);
    clock.advance(3_500);
    for (let t = 0; t < 4; t++) {
      clock.advance(15_000);
      await getRoomView(host, code, db); // solo el anfitrión sigue conectado
    }
    const view = (await getRoomView(host, code, db)).view;
    expect(view.status).toBe("abandoned");
    expect(view.result?.outcome).toBe("win");
    expect(view.players[2]!.status).toBe("abandoned");
  });

  it("salir antes de empezar no consume intentos; las salas de días anteriores caducan", async () => {
    const { host, guest, code } = await startedDuel();
    await joinRoom(guest, code, db);
    await leaveRoom(guest, code, db);
    let view = (await getRoomView(host, code, db)).view;
    expect(view.status).toBe("waiting");
    expect((await getMe(db, guest)).attempts.duel.used).toBe(false);

    // Al cambiar el día en Madrid la sala sin empezar caduca y no se convierte en partida nueva.
    clock.now = Date.UTC(2026, 9, 15, 22, 0, 1);
    view = (await getRoomView(host, code, db)).view;
    expect(view.status).toBe("expired");
    await expect(joinRoom(guest, code, db)).rejects.toMatchObject({ code: "room_expired" });
    await expect(setReady(host, code, true, db)).rejects.toMatchObject({ code: "room_expired" });
    expect(await sweepRooms(db)).toBeGreaterThanOrEqual(0);
  });

  it("modo voz: solo se activa si los dos lo aceptan y no cambia tras empezar", async () => {
    const { host, guest, code } = await startedDuel();
    await setVoice(host, code, true, db);
    let view = (await getRoomView(host, code, db)).view;
    expect(view.players[1]?.voice).toBe(true);
    expect(view.voiceActive).toBe(false);
    await joinRoom(guest, code, db, { voice: false });
    view = (await getRoomView(guest, code, db)).view;
    expect(view.voiceActive).toBe(false);
    await setVoice(guest, code, true, db);
    view = (await getRoomView(guest, code, db)).view;
    expect(view.voiceActive).toBe(true);
    await setReady(host, code, true, db);
    view = (await getRoomView(host, code, db)).view;
    expect(view.status).toBe("in_progress");
    expect(view.voiceActive).toBe(true);
    await expect(setVoice(guest, code, false, db)).rejects.toMatchObject({ code: "already_started" });
    const outsider = await newPlayer(db);
    await expect(setVoice(outsider, code, true, db)).rejects.toMatchObject({ status: 403 });
  });

  it("solicitudes simultáneas de inicio no crean intentos duplicados", async () => {
    const { host, guest, code } = await startedDuel();
    await joinRoom(guest, code, db);
    await Promise.allSettled([
      setReady(host, code, true, db),
      setReady(host, code, true, db),
      setReady(guest, code, true, db),
    ]);
    const attempts = await db.query<{ n: number }>("select count(*)::int as n from daily_attempts where kind = 'duel'");
    expect(attempts.rows[0]!.n).toBe(2);
    expect((await getRoomView(host, code, db)).view.status).toBe("in_progress");
  });

  it("programa completo 1 vs 1: pruebas por turnos y rosco final", async () => {
    const { host, guest, code } = await startedDuel("program");
    await joinRoom(guest, code, db);
    await setReady(host, code, true, db);
    const s = await sets("2026-10-15");
    clock.advance(3_500);
    let gv = (await getRoomView(guest, code, db)).view;
    expect(gv.stage.kind).toBe("quick");
    expect(gv.prompt).toMatchObject({ kind: "quick", index: 0 });
    const r = await roomAction(
      guest,
      code,
      { actionId: randomUUID(), action: { type: "answer", stage: 0, item: 0, text: s[2].quick[0]!.answers[0]! } },
      db,
    );
    expect(r.view.turn.seat).toBe(1); // en las pruebas el turno alterna tras cada pregunta
    expect(r.view.players[2]!.bonusSeconds).toBe(3);
    // Los demás turnos caducan por tiempo de jugada con ambos conectados.
    for (let i = 0; i < 60 && gv.stage.kind !== "rosco"; i++) {
      clock.advance(10_000);
      await getRoomView(host, code, db);
      gv = (await getRoomView(guest, code, db)).view;
    }
    expect(gv.stage.kind).toBe("rosco");
    expect(gv.players[2]!.bankMs).toBe(123_000);
    expect(gv.players[1]!.bankMs).toBe(120_000);
    expect(gv.turn.seat).toBe(1); // empieza quien tiene menos tiempo
  });
});
