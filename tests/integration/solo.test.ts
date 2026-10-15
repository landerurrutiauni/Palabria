import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getChallengeForDate, loadQuestionSet, todayKey } from "@/lib/server/challenges";
import type { Database } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import { getTodaySolo, soloAction, startSolo, sweepSoloSessions } from "@/lib/server/solo-service";
import { getMe } from "@/lib/server/stats-service";
import { createRoom } from "@/lib/server/room-service";
import { FakeClock, newPlayer, openTestDatabase, resetDatabase } from "../helpers/db";
import { randomUUID } from "node:crypto";

let db: Database;
// 15/10/2026 12:00 en Madrid (10:00 UTC)
const clock = new FakeClock(Date.UTC(2026, 9, 15, 10, 0, 0));

beforeAll(async () => {
  db = await openTestDatabase();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await resetDatabase(db);
  clock.now = Date.UTC(2026, 9, 15, 10, 0, 0);
  clock.install();
});

async function answersFor(date: string) {
  const challenge = await getChallengeForDate(db, date);
  return loadQuestionSet(db, challenge.id, "solo");
}

describe("partida individual en el servidor", () => {
  it("inicia, valida, pasa letras, recupera la partida y bloquea el segundo intento", async () => {
    const player = await newPlayer(db);
    const view = await startSolo(player, "rosco", db);
    expect(view.status).toBe("in_progress");
    expect(view.stage.prompt?.kind).toBe("rosco");
    expect(view.stage.remainingMs).toBe(180_000);
    const set = await answersFor(view.date);

    // Las respuestas de letras abiertas nunca viajan al navegador.
    const json = JSON.stringify(view);
    for (const item of set.rosco.slice(1)) expect(json).not.toContain(`"${item.answers[0]}"`);

    clock.advance(4_000);
    let r = await soloAction(
      player,
      {
        sessionId: view.sessionId,
        actionId: randomUUID(),
        action: { type: "answer", stage: 0, item: 0, text: set.rosco[0]!.answers[0]! },
      },
      db,
    );
    expect(r.feedback?.outcome).toBe("correct");
    clock.advance(3_000);
    r = await soloAction(
      player,
      {
        sessionId: view.sessionId,
        actionId: randomUUID(),
        action: { type: "answer", stage: 0, item: 1, text: "zzzz" },
      },
      db,
    );
    expect(r.feedback?.outcome).toBe("wrong");
    expect(r.feedback?.answer).toBe(set.rosco[1]!.answers[0]);
    const passId = randomUUID();
    r = await soloAction(
      player,
      { sessionId: view.sessionId, actionId: passId, action: { type: "pass", stage: 0, item: 2 } },
      db,
    );
    expect(r.view.stage.letters[2]!.state).toBe("passed");
    expect(r.view.stage.prompt).toMatchObject({ kind: "rosco", index: 3 });

    // Reenvío de la misma acción: no se aplica dos veces.
    const dup = await soloAction(
      player,
      { sessionId: view.sessionId, actionId: passId, action: { type: "pass", stage: 0, item: 2 } },
      db,
    );
    expect(dup.duplicate).toBe(true);
    expect(dup.view.totals).toEqual(r.view.totals);

    // Respuesta a una letra que ya no está activa (doble clic): se rechaza.
    await expect(
      soloAction(
        player,
        { sessionId: view.sessionId, actionId: randomUUID(), action: { type: "answer", stage: 0, item: 1, text: "x" } },
        db,
      ),
    ).rejects.toMatchObject({ code: "stale" });

    // Recarga: mismo estado, el reloj sigue desde el inicio original.
    clock.advance(10_000);
    const reloaded = await getTodaySolo(player, db);
    expect(reloaded?.sessionId).toBe(view.sessionId);
    expect(reloaded?.stage.remainingMs).toBe(180_000 - 17_000);
    expect(reloaded?.totals).toMatchObject({ correct: 1, wrong: 1, passed: 1 });

    // Mismo modo en otra pestaña: devuelve la misma partida, no gasta otro intento.
    const again = await startSolo(player, "rosco", db);
    expect(again.sessionId).toBe(view.sessionId);
    // Otro modo individual el mismo día: rechazado.
    await expect(startSolo(player, "program", db)).rejects.toMatchObject({ code: "solo_attempt_used" });
  });

  it("termina al agotarse el tiempo, guarda el resultado una sola vez y actualiza estadísticas", async () => {
    const player = await newPlayer(db);
    const view = await startSolo(player, "rosco", db);
    const set = await answersFor(view.date);
    for (let i = 0; i < 5; i++) {
      clock.advance(1_000);
      await soloAction(
        player,
        {
          sessionId: view.sessionId,
          actionId: randomUUID(),
          action: { type: "answer", stage: 0, item: i, text: set.rosco[i]!.answers[0]! },
        },
        db,
      );
    }
    clock.advance(200_000);
    const finished = await getTodaySolo(player, db);
    expect(finished?.status).toBe("completed");
    expect(finished?.result).toMatchObject({ correct: 5, wrong: 0, unanswered: 22, score: 50 });
    expect(finished?.result?.letters[10]?.answer).toBe(set.rosco[10]!.answers[0]);
    // Se puede releer sin duplicar resultados.
    await getTodaySolo(player, db);
    await sweepSoloSessions(db);
    const results = await db.query<{ n: number }>("select count(*)::int as n from game_results where player_id = $1", [
      player.id,
    ]);
    expect(results.rows[0]!.n).toBe(1);
    await expect(
      soloAction(
        player,
        { sessionId: view.sessionId, actionId: randomUUID(), action: { type: "answer", stage: 0, item: 6, text: "x" } },
        db,
      ),
    ).rejects.toMatchObject({ code: "finished" });
    const saved = await db.query<{ correct: number; score: number }>(
      "select correct, score from game_results where player_id = $1",
      [player.id],
    );
    expect(saved.rows).toEqual([{ correct: 5, score: 50 }]);
    expect((await getMe(db, player)).streak.current).toBe(1);
  });

  it("dos peticiones simultáneas no permiten dos partidas individuales", async () => {
    const player = await newPlayer(db);
    const results = await Promise.allSettled([startSolo(player, "rosco", db), startSolo(player, "program", db)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const sessions = await db.query<{ n: number }>(
      "select count(*)::int as n from game_sessions where player_id = $1",
      [player.id],
    );
    expect(sessions.rows[0]!.n).toBe(1);
    const attempts = await db.query<{ n: number }>(
      "select count(*)::int as n from daily_attempts where player_id = $1",
      [player.id],
    );
    expect(attempts.rows[0]!.n).toBe(1);
  });

  it("el intento individual no afecta al 1 vs 1", async () => {
    const player = await newPlayer(db);
    await startSolo(player, "program", db);
    const room = await createRoom(player, "rosco", db);
    expect(room.code).toMatch(/^[A-Za-z0-9_-]{16}$/);
    const me = await getMe(db, player);
    expect(me.attempts.solo.used).toBe(true);
    expect(me.attempts.duel.used).toBe(false);
    expect(me.attempts.duel.openRoomCode).toBe(room.code);
  });

  it("programa completo: todas las fases jugables y el rosco final con segundos ganados", async () => {
    const player = await newPlayer(db);
    const view = await startSolo(player, "program", db);
    expect(view.stages.map((s) => s.kind)).toEqual(["quick", "clues", "saying", "link", "rosco"]);
    const set = await answersFor(view.date);
    let v = view;
    const act = async (action: Parameters<typeof soloAction>[1]["action"]) => {
      clock.advance(1_000);
      const r = await soloAction(player, { sessionId: v.sessionId, actionId: randomUUID(), action }, db);
      v = r.view;
      return r;
    };
    for (let i = 0; i < 6; i++) await act({ type: "answer", stage: 0, item: i, text: set.quick[i]!.answers[0]! });
    expect(v.stage.status).toBe("ready");
    expect(v.totals.phasePoints).toBe(60);
    await act({ type: "start_stage", stage: 1 });
    expect(v.stage.prompt).toMatchObject({ kind: "clues", clues: [expect.any(String)] });
    await act({ type: "clue", stage: 1, item: 0 });
    expect(v.stage.prompt).toMatchObject({ kind: "clues", pointsNow: 30 });
    await act({ type: "answer", stage: 1, item: 0, text: set.clues[0]!.answers[0]! });
    await act({ type: "pass", stage: 1, item: 1 });
    await act({ type: "start_stage", stage: 2 });
    for (let i = 0; i < 5; i++) await act({ type: "answer", stage: 2, item: i, text: set.saying[i]!.answers[0]! });
    await act({ type: "start_stage", stage: 3 });
    for (let i = 0; i < 3; i++) await act({ type: "answer", stage: 3, item: i, text: set.link[i]!.answers[0]! });
    expect(v.upcomingRoscoMs).toBe(120_000 + (6 * 3 + 6 + 5 * 3 + 3 * 5) * 1000);
    await act({ type: "start_stage", stage: 4 });
    expect(v.stage.kind).toBe("rosco");
    expect(v.stage.timeLimitMs).toBe(120_000 + 54_000);
    clock.advance(200_000);
    const end = await getTodaySolo(player, db);
    expect(end?.status).toBe("completed");
    expect(end?.result?.phasePoints).toBe(60 + 30 + 75 + 60);
    expect(end?.result?.score).toBe(225);
    await expect(startSolo(player, "rosco", db)).rejects.toBeInstanceOf(AppError);
  });

  it("cambio de día en Madrid: nuevo desafío, nuevos intentos y racha consecutiva", async () => {
    const player = await newPlayer(db);
    const day1 = await startSolo(player, "rosco", db);
    clock.advance(181_000);
    await getTodaySolo(player, db);
    // 23:59:59 en Madrid del mismo día: sigue siendo el desafío del 15.
    clock.now = Date.UTC(2026, 9, 15, 21, 59, 59);
    expect(todayKey(clock.now)).toBe("2026-10-15");
    await expect(startSolo(player, "program", db)).rejects.toMatchObject({ code: "solo_attempt_used" });
    // 00:00 en Madrid (horario de verano, UTC+2).
    clock.now = Date.UTC(2026, 9, 15, 22, 0, 0);
    const day2 = await startSolo(player, "program", db);
    expect(day2.date).toBe("2026-10-16");
    const c1 = await getChallengeForDate(db, day1.date);
    const c2 = await getChallengeForDate(db, day2.date);
    expect(c1.id).not.toBe(c2.id);
    expect(c2.publicId).toBe("PAL-20261016");
    const s1 = await loadQuestionSet(db, c1.id, "solo");
    const s2 = await loadQuestionSet(db, c2.id, "solo");
    const shared = s1.rosco.filter((q, i) => q.id === s2.rosco[i]!.id).length;
    expect(shared).toBeLessThan(4);
    clock.advance(30 * 60_000 + 61_000 * 5);
    for (let i = 0; i < 6; i++) await getTodaySolo(player, db);
    const row = await db.query<{ last_streak_date: string }>(
      "select last_streak_date from player_statistics where player_id = $1",
      [player.id],
    );
    expect(row.rows[0]?.last_streak_date).toBe("2026-10-15");
  });
});
