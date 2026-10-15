/**
 * Configuración del servidor. Ningún valor de este módulo llega al navegador.
 */
export interface ServerEnv {
  databaseUrl: string | null;
  pgliteDir: string;
  appSecret: string;
  challengeSalt: string;
  isProduction: boolean;
  secureCookies: boolean;
  publicUrl: string | null;
  overridesDir: string;
}

const DEV_SECRET = "palabria-dev-secret-change-me-0123456789abcdef";

let cached: ServerEnv | null = null;
let saltFallback: string | null = null;

/**
 * Semilla guardada en la base de datos (app_settings) para cuando no se define
 * CHALLENGE_SALT. La variable de entorno, si existe, tiene prioridad.
 */
export function setChallengeSaltFallback(salt: string | null): void {
  saltFallback = salt?.trim() || null;
  cached = null;
}

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const isProduction = process.env.NODE_ENV === "production";
  const appSecret = process.env.APP_SECRET ?? "";
  if (isProduction && appSecret.length < 32 && process.env.ALLOW_INSECURE_DEV_SECRET !== "1") {
    throw new Error("APP_SECRET debe tener al menos 32 caracteres en producción.");
  }
  const publicUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? null;
  cached = {
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR?.trim() || ".data/pglite",
    appSecret: appSecret.length >= 32 ? appSecret : DEV_SECRET,
    challengeSalt: process.env.CHALLENGE_SALT?.trim() || saltFallback || "palabria-default-salt",
    isProduction,
    secureCookies: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProduction,
    publicUrl,
    overridesDir: process.env.CHALLENGE_OVERRIDES_DIR?.trim() || "content/overrides",
  };
  return cached;
}

/** Solo para pruebas. */
export function resetServerEnvCache(): void {
  cached = null;
}
