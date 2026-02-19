import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://surething:surething_dev@localhost:5432/surething';

// Connection pool for queries
const queryClient = postgres(connectionString, { max: 10 });

export const db = drizzle(queryClient, { schema });

// For graceful shutdown
export async function closeDb() {
  await queryClient.end();
}
