import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://surething:surething_dev@localhost:5432/surething';
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log('[DB] Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[DB] Migrations complete');

  await sql.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('[DB] Migration failed:', err);
  process.exit(1);
});
