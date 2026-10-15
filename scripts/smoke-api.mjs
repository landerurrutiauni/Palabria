/**
 * Prueba de humo de la API independiente (Edge Function o servidor de
 * desarrollo con DEV_AUTH=1). Uso: node scripts/smoke-api.mjs http://localhost:3400/api
 */
import { randomUUID } from "node:crypto";

const base = process.argv[2] ?? "http://localhost:3300";
const client = () => {
  const token = `dev.${randomUUID()}`;
  return async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json() };
  };
};
const check = (label, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${label}${extra ? ` · ${extra}` : ""}`);
  if (!cond) process.exitCode = 1;
};

const a = client();
const health = await a("GET", "/health");
check("health", health.status === 200, JSON.stringify(health.json));
const me = await a("GET", "/me");
check("identidad anónima", me.status === 200 && !me.json.attempts.solo.used, me.json.displayName);
const start = await a("POST", "/solo", { mode: "rosco" });
check("empezar rosco", start.status === 200 && start.json.session.status === "in_progress");
const pass = await a("POST", "/solo/action", {
  sessionId: start.json.session.sessionId,
  actionId: randomUUID(),
  action: { type: "pass", stage: 0, item: 0 },
});
check("palabria", pass.json.feedback?.outcome === "passed");
const again = await a("POST", "/solo", { mode: "program" });
check("intento compartido bloqueado", again.status === 409);

const host = client();
const guest = client();
const room = await host("POST", "/rooms", { mode: "rosco" });
check("crear sala", room.status === 201);
await guest("POST", `/rooms/${room.json.code}/join`);
const ready = await host("POST", `/rooms/${room.json.code}/ready`, { ready: true });
check("duelo en curso", ready.json.room?.status === "in_progress");
await new Promise((r) => setTimeout(r, 3800));
const out = await host("POST", `/rooms/${room.json.code}/action`, {
  actionId: randomUUID(),
  action: { type: "pass", stage: 0, item: 0 },
});
check("fuera de turno rechazado", out.status === 409 && out.json.error.code === "not_your_turn");
const gp = await guest("POST", `/rooms/${room.json.code}/action`, {
  actionId: randomUUID(),
  action: { type: "pass", stage: 0, item: 0 },
});
check("palabria cede el turno", gp.json.view?.turn.seat === 1);
