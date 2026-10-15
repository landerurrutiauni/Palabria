/**
 * Identidades anónimas (portable: Node.js y Supabase Edge Functions).
 *  - Servidor Node.js: token aleatorio firmado guardado en una cookie HttpOnly.
 *  - GitHub Pages + Supabase: sesión anónima de Supabase Auth (sin registro);
 *    se identifica por el `sub` del JWT verificado.
 */
import type { Queryable } from "./db-core";
import { identitySecret, tokenHash, verifyIdentityToken } from "./identity-token";
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

/** Obtiene (o crea) la identidad asociada a un usuario anónimo de Supabase Auth. */
export async function playerFromAuthUser(db: Queryable, authUserId: string): Promise<Player | null> {
  if (!/^[0-9a-f-]{36}$/i.test(authUserId)) return null;
  const select = () =>
    db.query<PlayerRow>(
      `select id, display_name, name_is_custom, last_seen_at < now() - interval '10 minutes' as stale
         from anonymous_players where auth_user_id = $1`,
      [authUserId],
    );
  let row = (await select()).rows[0];
  if (!row) {
    await db.query(
      `insert into anonymous_players (auth_user_id, display_name) values ($1, $2) on conflict (auth_user_id) do nothing`,
      [authUserId, defaultDisplayName(authUserId)],
    );
    row = (await select()).rows[0];
  } else if (row.stale) {
    await db.query("update anonymous_players set last_seen_at = now() where id = $1", [row.id]);
  }
  if (!row) return null;
  return { id: row.id, displayName: row.display_name, nameIsCustom: row.name_is_custom };
}
