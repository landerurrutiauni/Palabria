import { currentPlayer, type Player } from "./identity";

/**
 * Identidad en páginas de servidor. El proxy garantiza la cookie; si aun así
 * faltara (p. ej. cookies bloqueadas), se lanza un error explicativo.
 */
export async function requirePlayerForPage(): Promise<Player> {
  const player = await currentPlayer();
  if (!player) {
    throw new Error(
      "No se ha podido leer tu identidad anónima. Activa las cookies de este sitio para guardar tus partidas.",
    );
  }
  return player;
}
