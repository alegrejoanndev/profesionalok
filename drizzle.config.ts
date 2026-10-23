import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('.env'); // en CI y hosting las variables ya vienen del entorno
} catch {
  /* sin archivo .env */
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
