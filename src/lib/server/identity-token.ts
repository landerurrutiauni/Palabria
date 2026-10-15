/**
 * Token de identidad anónima guardado en una cookie HttpOnly.
 * Formato: v1.<aleatorio>.<firma>
 *  - <aleatorio>: 24 bytes de crypto.randomBytes (192 bits, imposible de adivinar).
 *  - <firma>: HMAC-SHA256 con APP_SECRET; el servidor rechaza tokens no emitidos por él.
 * En la base de datos solo se guarda el SHA-256 del valor aleatorio.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const IDENTITY_COOKIE = "palabria_id";
export const IDENTITY_MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // límite de los navegadores actuales

function sign(secret: string, random: string): string {
  return createHmac("sha256", secret).update(`v1.${random}`).digest("base64url").slice(0, 32);
}

export function mintIdentityToken(secret: string): string {
  const random = randomBytes(24).toString("base64url");
  return `v1.${random}.${sign(secret, random)}`;
}

/** Devuelve la parte aleatoria si el token es válido, o null. */
export function verifyIdentityToken(token: string | undefined | null, secret: string): string | null {
  if (!token || token.length > 128) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, random, signature] = parts as [string, string, string];
  if (!/^[A-Za-z0-9_-]{32}$/.test(random)) return null;
  const expected = Buffer.from(sign(secret, random));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return random;
}

export function tokenHash(random: string): string {
  return createHash("sha256").update(random).digest("hex");
}

export function identitySecret(): string {
  const secret = process.env.APP_SECRET ?? "";
  return secret.length >= 32 ? secret : "palabria-dev-secret-change-me-0123456789abcdef";
}

export function secureCookies(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
}

export function identityCookieOptions() {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: IDENTITY_MAX_AGE_SECONDS,
  };
}
