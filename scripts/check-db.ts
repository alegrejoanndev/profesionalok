/** Verifica que la base de datos responda y, si no, explica qué hacer en lenguaje simple. */
try {
  process.loadEnvFile('.env');
} catch {
  /* sin .env */
}
import { Client } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('\n✘ Falta DATABASE_URL en el archivo .env.\n  Copiá .env.example como .env y completá esa línea.\n');
    process.exit(1);
  }
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 4000 });
  try {
    await client.connect();
    await client.query('select 1');
    await client.end();
    console.log('✔ La base de datos responde.');
  } catch (err) {
    console.error('\n✘ No pude conectarme a la base de datos.');
    console.error(`  Motivo: ${(err as Error).message}`);
    console.error('\n  Si usás Docker, ¿lo iniciaste? Ejecutá:  docker compose up -d');
    console.error('  y esperá unos segundos antes de volver a probar.');
    console.error('  Si usás una base en la nube (Neon, Supabase), revisá que la URL de .env esté completa.\n');
    process.exit(1);
  }
}

main();
