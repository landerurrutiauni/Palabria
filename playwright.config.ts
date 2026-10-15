import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de extremo a extremo contra el servidor de producción (`next start`).
 * Requieren una base PostgreSQL real en E2E_DATABASE_URL (o DATABASE_URL):
 * las pruebas leen de ella las respuestas del día para poder acertar.
 * Ejecuta antes `npm run build`.
 */
const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseUrl,
      APP_SECRET: "e2e-secret-0123456789abcdef0123456789abcdef",
      CHALLENGE_SALT: "e2e-salt",
      // Relojes cortos para poder probar el fin de tiempo.
      ROSCO_SECONDS: "25",
      PROGRAM_ROSCO_BASE_SECONDS: "20",
      DUEL_ROSCO_SECONDS: "25",
      DUEL_RECONNECT_GRACE_SECONDS: "20",
      COOKIE_SECURE: "false",
      // Las pruebas automáticas responden mucho más rápido que una persona.
      ACTION_RATE_LIMIT: "1000",
    },
  },
});
