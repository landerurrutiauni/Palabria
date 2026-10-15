/**
 * Empaqueta la Edge Function de Supabase (Deno) a partir del código del juego.
 * Las dependencias npm con módulos nativos de Node se cargan con `npm:` en Deno.
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const NPM = {
  pg: "npm:pg@8.23.1",
  "@supabase/supabase-js": "npm:@supabase/supabase-js@2.118.0",
};

// `--dev <salida>`: variante de prueba con autenticación de desarrollo (no se despliega).
const devIndex = process.argv.indexOf("--dev");
const dev = devIndex >= 0;
const outfile = dev ? process.argv[devIndex + 1] : `${root}supabase/functions/api/server.js`;

await build({
  entryPoints: [dev ? `${root}src/edge/dev-main.ts` : `${root}src/edge/main.ts`],
  outfile,
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  mainFields: ["module", "main"],
  conditions: ["import", "default"],
  tsconfig: `${root}tsconfig.json`,
  legalComments: "none",
  banner: {
    js: [
      "// Archivo generado por scripts/build-edge.mjs: no editar a mano.",
      'import __process from "node:process";',
      "globalThis.process ??= __process;",
    ].join("\n"),
  },
  plugins: [
    {
      name: "deno-externals",
      setup(b) {
        b.onResolve({ filter: /^(pg|@supabase\/supabase-js)$/ }, (args) => ({ path: NPM[args.path], external: true }));
        b.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, external: true }));
        b.onResolve({ filter: /^@electric-sql\/pglite$/ }, () => ({
          errors: [{ text: "PGlite no debe incluirse en la Edge Function" }],
        }));
      },
    },
  ],
});
console.log(`Edge Function empaquetada en ${outfile}`);
