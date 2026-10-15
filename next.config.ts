import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const turbopack: NextConfig["turbopack"] = {
  rules: {
    "*.css": {
      loaders: ["@tailwindcss/turbopack"],
      as: "*.css",
    },
  },
};

/**
 * Versión estática para GitHub Pages (NEXT_OUTPUT=export). Solo se compilan
 * los ficheros `*.static.tsx` de `src/app`: pantallas que cargan los datos en
 * el navegador desde la Supabase Edge Function. Sin API, proxy ni cookies.
 */
const staticExport: NextConfig = {
  output: "export",
  pageExtensions: ["static.tsx", "static.ts"],
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  turbopack,
};

const server: NextConfig = {
  // Imagen Docker compacta: NEXT_OUTPUT=standalone (ver Dockerfile). Por defecto, `next start`.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  // Drivers de base de datos: se cargan desde node_modules en el servidor.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Ficheros que el servidor lee en tiempo de ejecución (migraciones y ediciones manuales).
  outputFileTracingIncludes: {
    "/**": ["./supabase/migrations/**/*", "./content/overrides/**/*"],
  },
  turbopack,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default process.env.NEXT_OUTPUT === "export" ? staticExport : server;
