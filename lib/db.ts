import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

/** ¿Hay base de datos configurada? Sin ella el sitio funciona en "modo demo" (solo lectura). */
export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

// Singleton: evita abrir conexiones nuevas en cada recarga en desarrollo.
const g = globalThis as unknown as { __db?: NodePgDatabase<typeof schema> };

export function getDb(): NodePgDatabase<typeof schema> {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en el archivo .env');
  if (!g.__db) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    g.__db = drizzle(pool, { schema });
  }
  return g.__db;
}
