/**
 * Autenticación de desarrollo para la API independiente (solo con DEV_AUTH=1).
 * El navegador genera un identificador aleatorio `dev.<uuid>` y lo envía como
 * token Bearer, imitando la sesión anónima de Supabase sin necesitar Supabase.
 * Nunca se activa en la Edge Function de producción.
 */
import type { Database } from "./db-core";
import { bearerToken } from "./api-handler";
import { playerFromAuthUser, type Player } from "./players";

export async function devAuthenticate(request: Request, db: Database): Promise<Player | null> {
  const token = bearerToken(request);
  const match = token ? /^dev\.([0-9a-f-]{36})$/i.exec(token) : null;
  if (!match) return null;
  return playerFromAuthUser(db, match[1]!.toLowerCase());
}
