import { cookies } from "next/headers";
import type { Queryable } from "./db";
import { getDb } from "./db";
import { AppError } from "./errors";
import {
  IDENTITY_COOKIE,
  identityCookieOptions,
  identitySecret,
  mintIdentityToken,
  tokenHash,
  verifyIdentityToken,
} from "./identity-token";
import { defaultDisplayName } from "./names";

export interface Player {
  id: string;
  displayName: string;
  nameIsCustom: boolean;
}

interface PlayerRow {
  id: string;
  display_name: string;
  name_is_custom: boolean;
  stale: boolean;
}

/** Obtiene (o crea la primera vez) la identidad asociada a un token válido. */
export async function playerFromToken(db: Queryable, token: string | null | undefined): Promise<Player | null> {
  const random = verifyIdentityToken(token, identitySecret());
  if (!random) return null;
  const hash = tokenHash(random);
  const select = () =>
    db.query<PlayerRow>(
      `select id, display_name, name_is_custom, last_seen_at < now() - interval '10 minutes' as stale
         from anonymous_players where token_hash = $1`,
      [hash],
    );
  let row = (await select()).rows[0];
  if (!row) {
    await db.query(
      `insert into anonymous_players (token_hash, display_name) values ($1, $2) on conflict (token_hash) do nothing`,
      [hash, defaultDisplayName(hash)],
    );
    row = (await select()).rows[0];
  } else if (row.stale) {
    await db.query("update anonymous_players set last_seen_at = now() where id = $1", [row.id]);
  }
  if (!row) return null;
  return { id: row.id, displayName: row.display_name, nameIsCustom: row.name_is_custom };
}

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
