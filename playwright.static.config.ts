import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de extremo a extremo de la versión GitHub Pages: la exportación
 * estática servida bajo /Pasapalabra (como en Pages) contra la misma API que
 * ejecuta la Supabase Edge Function (servidor de desarrollo con identidades
 * anónimas simuladas). Antes hay que compilar la exportación:
 *   NEXT_PUBLIC_BASE_PATH=/Pasapalabra NEXT_PUBLIC_API_URL=http://localhost:3301 \
 *   NEXT_PUBLIC_DEV_AUTH=1 npm run build:pages
 */
const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  testDir: "tests/e2e-static",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3501",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx tsx scripts/api-server.ts",
      url: "http://localhost:3301/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DEV_AUTH: "1",
        API_PORT: "3301",
        DATABASE_URL: databaseUrl,
        CHALLENGE_SALT: "e2e-salt",
        ROSCO_SECONDS: "25",
        PROGRAM_ROSCO_BASE_SECONDS: "20",
        DUEL_ROSCO_SECONDS: "25",
        DUEL_RECONNECT_GRACE_SECONDS: "20",
        ACTION_RATE_LIMIT: "1000",
      },
    },
    {
      command: "node scripts/serve-static.mjs 3501",
      url: "http://localhost:3501/Pasapalabra/",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { NEXT_PUBLIC_BASE_PATH: "/Pasapalabra" },
    },
  ],
});
