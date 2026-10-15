/**
 * Aplica las migraciones SQL pendientes de supabase/migrations.
 * Uso: npm run db:migrate   (usa DATABASE_URL o, si no existe, la base embebida PGlite)
 */
import { openDatabase, runMigrations } from "@/lib/server/db";

async function main() {
  const db = await openDatabase({ migrate: false });
  try {
    const applied = await runMigrations(db);
    console.log(`Base de datos (${db.kind}) al día.`);
    if (applied.length) console.log(`Migraciones aplicadas:\n  ${applied.join("\n  ")}`);
    else console.log("No había migraciones pendientes.");
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
