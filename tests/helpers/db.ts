import { setClockForTesting } from "@/lib/server/clock";
import { openDatabase, setDbForTesting, type Database } from "@/lib/server/db";
import { playerFromToken, type Player } from "@/lib/server/identity";
import { identitySecret, mintIdentityToken } from "@/lib/server/identity-token";

/**
 * Base de datos para pruebas de integración:
 *  - TEST_DATABASE_URL → PostgreSQL real.
 *  - Si no, PostgreSQL embebido (PGlite) en memoria.
 */
export async function openTestDatabase(): Promise<Database> {
  const url = process.env.TEST_DATABASE_URL ?? null;
  const db = await openDatabase({ url, pgliteDir: null, migrate: true });
  setDbForTesting(db);
  return db;
}

export async function resetDatabase(db: Database): Promise<void> {
  await db.exec(`truncate table game_answers, game_results, daily_attempts, multiplayer_participants, multiplayer_rooms,
    game_sessions, daily_questions, daily_challenges, player_statistics, player_preferences, anonymous_players cascade`);
}

export class FakeClock {
  constructor(public now: number) {}
  advance(ms: number): number {
    this.now += ms;
    return this.now;
  }
  install(): void {
    setClockForTesting(() => this.now);
  }
}

export async function newPlayer(db: Database): Promise<Player & { token: string }> {
  const token = mintIdentityToken(identitySecret());
  const player = await playerFromToken(db, token);
  if (!player) throw new Error("No se pudo crear el jugador de prueba");
  return { ...player, token };
}
