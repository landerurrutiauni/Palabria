/**
 * Prepara el proyecto de Supabase con la API de gestión (solo necesita un
 * token personal, SUPABASE_ACCESS_TOKEN; no hace falta la contraseña de la
 * base de datos):
 *  1. Activa el inicio de sesión anónimo (identidad sin registro).
 *  2. Aplica las migraciones de supabase/migrations que falten, en orden,
 *     registrándolas en schema_migrations (igual que el servidor Node.js).
 *   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/supabase-setup.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error("Faltan SUPABASE_ACCESS_TOKEN o SUPABASE_PROJECT_REF.");
  process.exit(1);
}
const api = `https://api.supabase.com/v1/projects/${ref}`;

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.replace(api, "")} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const sql = (query) => call("POST", `${api}/database/query`, { query });

// 1. Identidad anónima.
const auth = await call("GET", `${api}/config/auth`);
if (auth?.external_anonymous_users_enabled) {
  console.log("✓ Inicio de sesión anónimo ya activado");
} else {
  await call("PATCH", `${api}/config/auth`, { external_anonymous_users_enabled: true });
  console.log("✓ Inicio de sesión anónimo activado");
}

// 2. Migraciones.
await sql(`create table if not exists public.schema_migrations (
  name text primary key, applied_at timestamptz not null default now());
alter table public.schema_migrations enable row level security;`);
const rows = await sql("select name from public.schema_migrations");
const done = new Set((rows ?? []).map((r) => r.name));
const dir = path.resolve("supabase/migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  if (done.has(file)) {
    console.log(`· ${file} (ya aplicada)`);
    continue;
  }
  if (!/^[\w.-]+$/.test(file)) throw new Error(`Nombre de migración no válido: ${file}`);
  const body = await readFile(path.join(dir, file), "utf8");
  // Una sola consulta con varias sentencias: se ejecuta en una transacción implícita.
  await sql(`${body}\n;\ninsert into public.schema_migrations (name) values ('${file}') on conflict do nothing;`);
  console.log(`✓ ${file}`);
}
console.log("Base de datos lista.");
