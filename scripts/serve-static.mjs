/**
 * Servidor de ficheros mínimo que imita GitHub Pages para probar la
 * exportación estática en local: sirve `out/` bajo el prefijo del repositorio
 * (NEXT_PUBLIC_BASE_PATH), resuelve `carpeta/` → `carpeta/index.html` y
 * responde 404.html a lo desconocido.
 *   node scripts/serve-static.mjs [puerto]
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = path.resolve("out");
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const port = Number(process.argv[2] ?? process.env.STATIC_PORT ?? 3500);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function file(p) {
  try {
    const s = await stat(p);
    return s.isFile() ? p : null;
  } catch {
    return null;
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (base && pathname === base) {
      res.writeHead(301, { Location: `${base}/${url.search}` });
      return res.end();
    }
    if (base && !pathname.startsWith(`${base}/`)) pathname = "/__fuera__";
    else pathname = pathname.slice(base.length);
    const target = path.join(root, pathname);
    if (!target.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    let found = pathname.endsWith("/") ? await file(path.join(target, "index.html")) : await file(target);
    if (!found && !pathname.endsWith("/") && (await file(path.join(target, "index.html")))) {
      res.writeHead(301, { Location: `${base}${pathname}/${url.search}` });
      return res.end();
    }
    let status = 200;
    if (!found) {
      found = await file(path.join(root, "404.html"));
      status = 404;
    }
    if (!found) {
      res.writeHead(404);
      return res.end("404");
    }
    res.writeHead(status, { "Content-Type": types[path.extname(found)] ?? "application/octet-stream" });
    createReadStream(found).pipe(res);
  })
  .listen(port, () => console.log(`Exportación estática en http://localhost:${port}${base}/`));
