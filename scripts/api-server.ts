/**
 * Servidor HTTP de desarrollo con la misma API que la Supabase Edge Function.
 * Sirve para probar la versión estática (GitHub Pages) sin un proyecto de
 * Supabase: identidad anónima simulada con tokens `dev.<uuid>` y sin Realtime
 * (el navegador sondea el estado de la sala).
 *   DEV_AUTH=1 DATABASE_URL=postgres://… npx tsx scripts/api-server.ts
 */
import http from "node:http";
import { createApiHandler } from "@/lib/server/api-handler";
import { getDb } from "@/lib/server/db";
import { devAuthenticate } from "@/lib/server/dev-auth";

if (process.env.DEV_AUTH !== "1") {
  console.error("Este servidor solo es para desarrollo: arráncalo con DEV_AUTH=1.");
  process.exit(1);
}

const port = Number(process.env.API_PORT ?? 3300);
const handler = createApiHandler({
  getDb,
  authenticate: devAuthenticate,
  allowedOrigins: "*",
  background: (task) => void task,
});

const server = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:${port}${req.url ?? "/"}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, () => console.log(`API de desarrollo en http://localhost:${port}`));
