"use client";

/**
 * Identidad anónima en la versión GitHub Pages + Supabase: sesión anónima de
 * Supabase Auth (sin registro, sin correo ni contraseña). supabase-js la guarda
 * en este navegador y la renueva sola. En desarrollo sin Supabase se usa un
 * identificador `dev.<uuid>` (solo válido contra el servidor de desarrollo).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === "1";

let client: SupabaseClient | null = null;
let inflight: Promise<string> | null = null;

export function supabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "palabria-auth" },
  });
  return client;
}

export function publicApiKey(): string {
  return SUPABASE_KEY;
}

function devToken(): string {
  const key = "palabria-dev-identity";
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) return stored;
    const token = `dev.${crypto.randomUUID()}`;
    window.localStorage.setItem(key, token);
    return token;
  } catch {
    return `dev.${crypto.randomUUID()}`;
  }
}

async function obtainToken(sb: SupabaseClient, renew: boolean): Promise<string> {
  if (renew) {
    const refreshed = await sb.auth.refreshSession();
    if (refreshed.data.session) return refreshed.data.session.access_token;
  }
  const { data } = await sb.auth.getSession();
  if (data.session) {
    // Si la renovación falló pero la sesión sigue guardada (p. ej. sin red), no se crea otra identidad.
    if (renew) throw new Error("No se pudo renovar la sesión. Inténtalo de nuevo.");
    return data.session.access_token;
  }
  const signIn = await sb.auth.signInAnonymously();
  if (signIn.error || !signIn.data.session) {
    throw new Error(signIn.error?.message ?? "No se pudo crear la identidad anónima.");
  }
  return signIn.data.session.access_token;
}

/**
 * Token de acceso de la identidad anónima (la crea la primera vez). Las
 * peticiones simultáneas comparten la misma operación para no crear dos
 * identidades en la primera visita.
 */
export async function accessToken(options: { renew?: boolean } = {}): Promise<string> {
  if (DEV_AUTH) return devToken();
  const sb = supabaseClient();
  if (!sb)
    throw new Error("Falta la configuración de Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  if (options.renew) return obtainToken(sb, true);
  inflight ??= obtainToken(sb, false).finally(() => {
    inflight = null;
  });
  return inflight;
}
