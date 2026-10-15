import { cookies } from "next/headers";
import { getDb } from "./db";
import { AppError } from "./errors";
import { IDENTITY_COOKIE, identityCookieOptions, identitySecret, mintIdentityToken } from "./identity-token";
import { playerFromToken, type Player } from "./players";

export { playerFromAuthUser, playerFromToken, type Player } from "./players";

/**
 * Identidad del visitante en un manejador de ruta. Si la cookie falta o no es
 * válida se emite una nueva (no hay registro ni datos personales).
 */
export async function requirePlayer(): Promise<Player> {
  const jar = await cookies();
  const db = await getDb();
  let token = jar.get(IDENTITY_COOKIE)?.value;
  let player = await playerFromToken(db, token);
  if (!player) {
    token = mintIdentityToken(identitySecret());
    jar.set(IDENTITY_COOKIE, token, identityCookieOptions());
    player = await playerFromToken(db, token);
  }
  if (!player) throw new AppError(500, "identity", "No se pudo crear la identidad anónima.");
  return player;
}

/** Identidad del visitante en un componente de servidor (la crea el proxy). */
export async function currentPlayer(): Promise<Player | null> {
  const jar = await cookies();
  const db = await getDb();
  return playerFromToken(db, jar.get(IDENTITY_COOKIE)?.value);
}
