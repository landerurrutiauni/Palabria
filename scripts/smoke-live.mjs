/**
 * Comprobación del juego publicado (GitHub Pages + Supabase), sin secretos:
 *  1. La API de la Edge Function responde y llega a la base de datos.
 *  2. CORS permite el origen de GitHub Pages.
 *  3. El inicio de sesión anónimo de Supabase está activado y la API acepta
 *     esa identidad (crea un jugador de prueba).
 *  4. La web de GitHub Pages está publicada.
 *   SUPABASE_PROJECT_REF=… SUPABASE_PUBLISHABLE_KEY=… SITE_URL=… node scripts/smoke-live.mjs
 */
const ref = process.env.SUPABASE_PROJECT_REF;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const site = process.env.SITE_URL;
if (!ref || !key || !site) {
  console.error("Faltan SUPABASE_PROJECT_REF, SUPABASE_PUBLISHABLE_KEY o SITE_URL.");
  process.exit(1);
}
const supabase = `https://${ref}.supabase.co`;
const api = `${supabase}/functions/v1/api`;
const origin = new URL(site).origin;
let failures = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    failures++;
    console.log(`✗ ${name} — ${error.message}`);
    console.log(`::error::${name}: ${error.message}`);
  }
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
}

await check("API /health", async () => {
  const body = await json(await fetch(`${api}/health`));
  if (!body.ok) throw new Error(JSON.stringify(body));
  return `base de datos ${body.database}, día ${body.today}`;
});

await check("Desafío del día", async () => {
  const body = await json(await fetch(`${api}/challenge`));
  if (!body.publicId || body.letters?.length !== 27) throw new Error(JSON.stringify(body).slice(0, 200));
  return `${body.publicId} (${body.difficulty})`;
});

await check("CORS para GitHub Pages", async () => {
  const res = await fetch(`${api}/me`, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
  });
  const allowed = res.headers.get("access-control-allow-origin");
  if (res.status !== 204 || (allowed !== origin && allowed !== "*")) {
    throw new Error(`estado ${res.status}, allow-origin ${allowed}`);
  }
  return allowed;
});

await check("Identidad anónima", async () => {
  const res = await fetch(`${supabase}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: "{}",
  });
  const session = await json(res);
  if (!session.access_token) {
    throw new Error(
      `${res.status} ${session.msg ?? session.message ?? session.error_code ?? ""} ` +
        "(Supabase → Authentication → Sign In / Providers → Allow anonymous sign-ins)",
    );
  }
  const me = await json(
    await fetch(`${api}/me`, {
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: key, Origin: origin },
    }),
  );
  if (!me.displayName) throw new Error(`la API rechaza la sesión: ${JSON.stringify(me).slice(0, 200)}`);
  return `jugador de prueba «${me.displayName}»`;
});

await check("Web en GitHub Pages", async () => {
  const res = await fetch(site);
  const html = await res.text();
  if (!res.ok || !html.includes("Palabria")) throw new Error(`estado ${res.status}`);
  return site;
});

if (failures > 0) process.exit(1);
console.log("Todo listo: el juego está publicado y funcionando.");
