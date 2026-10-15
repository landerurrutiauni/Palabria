import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { apiPath, createApiHandler } from "@/lib/server/api-handler";
import { getChallengeForDate, loadQuestionSet } from "@/lib/server/challenges";
import type { Database } from "@/lib/server/db";
import { devAuthenticate } from "@/lib/server/dev-auth";
import { FakeClock, openTestDatabase, resetDatabase } from "../helpers/db";

let db: Database;
let handler: (request: Request) => Promise<Response>;
const clock = new FakeClock(Date.UTC(2026, 9, 15, 10, 0, 0));
const BASE = "https://proyecto.supabase.co/functions/v1/api";

beforeAll(async () => {
  db = await openTestDatabase();
  handler = createApiHandler({
    getDb: async () => db,
    authenticate: devAuthenticate,
    allowedOrigins: ["https://landerurrutiauni.github.io"],
  });
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await resetDatabase(db);
  clock.now = Date.UTC(2026, 9, 15, 10, 0, 0);
  clock.install();
});

function client() {
  const token = `dev.${randomUUID()}`;
  return async (method: string, path: string, body?: unknown, origin = "https://landerurrutiauni.github.io") => {
    const res = await handler(
      new Request(`${BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: origin,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return {
      status: res.status,
      headers: res.headers,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- respuestas JSON arbitrarias en la prueba
      json: (await res.json()) as Record<string, any>,
    };
  };
}

describe("API independiente (Edge Function)", () => {
  it("normaliza las rutas de Supabase", () => {
    expect(apiPath("/functions/v1/api/rooms/abc/join")).toBe("/rooms/abc/join");
    expect(apiPath("/api/me/")).toBe("/me");
    expect(apiPath("/me")).toBe("/me");
  });

  it("CORS: responde al preflight y rechaza orígenes no permitidos", async () => {
    const pre = await handler(
      new Request(`${BASE}/solo`, { method: "OPTIONS", headers: { Origin: "https://landerurrutiauni.github.io" } }),
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("https://landerurrutiauni.github.io");
    const api = client();
    const bad = await api("POST", "/solo", { mode: "rosco" }, "https://malicioso.example");
    expect(bad.status).toBe(403);
  });

  it("exige identidad anónima válida", async () => {
    const res = await handler(new Request(`${BASE}/me`, { headers: { Authorization: "Bearer inventado" } }));
    expect(res.status).toBe(401);
    const health = await handler(new Request(`${BASE}/health`));
    expect(health.status).toBe(200);
  });

  it("partida individual completa a través de la API", async () => {
    const api = client();
    const me = await api("GET", "/me");
    expect(me.status).toBe(200);
    expect(me.json.attempts.solo.used).toBe(false);
    const start = await api("POST", "/solo", { mode: "rosco" });
    expect(start.status).toBe(200);
    const sessionId = start.json.session.sessionId as string;
    const challenge = await getChallengeForDate(db, "2026-10-15");
    const set = await loadQuestionSet(db, challenge.id, "solo");
    const ok = await api("POST", "/solo/action", {
      sessionId,
      actionId: randomUUID(),
      action: { type: "answer", stage: 0, item: 0, text: set.rosco[0]!.answers[0] },
    });
    expect(ok.json.feedback.outcome).toBe("correct");
    const other = await api("POST", "/solo", { mode: "program" });
    expect(other.status).toBe(409);
    expect(other.json.error.code).toBe("solo_attempt_used");
    clock.advance(181_000);
    const end = await api("GET", "/solo");
    expect(end.json.session.status).toBe("completed");
    expect(end.json.session.result.correct).toBe(1);
    const gone = await api("GET", "/stats");
    expect(gone.status).toBe(404);
  });

  it("duelo: crear, unirse, empezar y rechazar acciones fuera de turno", async () => {
    const host = client();
    const guest = client();
    const created = await host("POST", "/rooms", { mode: "rosco" });
    expect(created.status).toBe(201);
    const code = created.json.code as string;
    const invite = await guest("GET", `/rooms/${code}`);
    expect(invite.json.room.canJoin).toBe(true);
    await guest("POST", `/rooms/${code}/join`, { voice: true });
    const voiced = await host("POST", `/rooms/${code}/voice`, { enabled: true });
    expect(voiced.json.room.voiceActive).toBe(true);
    const started = await host("POST", `/rooms/${code}/ready`, { ready: true });
    expect(started.json.room.status).toBe("in_progress");
    clock.advance(4_000);
    const outOfTurn = await host("POST", `/rooms/${code}/action`, {
      actionId: randomUUID(),
      action: { type: "pass", stage: 0, item: 0 },
    });
    expect(outOfTurn.status).toBe(409);
    expect(outOfTurn.json.error.code).toBe("not_your_turn");
    const pass = await guest("POST", `/rooms/${code}/action`, {
      actionId: randomUUID(),
      action: { type: "pass", stage: 0, item: 0 },
    });
    expect(pass.json.view.turn.seat).toBe(1);
    const third = client();
    const blocked = await third("GET", `/rooms/${code}`);
    expect(blocked.status).toBe(403);
  });
});
