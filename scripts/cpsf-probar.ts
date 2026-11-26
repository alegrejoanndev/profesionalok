/**
 * Lee el padrón del Colegio de Psicólogos de Santa Fe y muestra lo que se entiende.
 *   npm run cpsf:probar            → primera página + total del padrón
 *   npm run cpsf:probar -- 1234    → busca esa matrícula
 * Sirve para confirmar, una sola vez, que el lector interpreta bien el HTML real del sitio.
 */
import { crawlCpsf, parseCpsfHtml } from '../lib/cpsf';

async function main() {
  const base = (process.env.CPSF_URL ?? 'https://www.cpsf.org.ar/matriculados').replace(/\/+$/, '');
  const res = await fetch(base, { headers: { 'User-Agent': 'ProfesionalesOk/1.0' } });
  console.log(`GET ${base} → ${res.status}`);
  const first = parseCpsfHtml(await res.text());
  console.log(`Filas leídas en la primera página: ${first.length}`);
  console.table(first.slice(0, 5));
  if (first.length === 0) return console.log('No se leyeron filas: hay que ajustar parseCpsfHtml() a la estructura real del sitio.');
  const all = await crawlCpsf();
  console.log(`Padrón completo: ${all.length} matriculados`);
  const q = process.argv[2];
  if (q) console.table(all.filter((r) => r.numero === q.replace(/^0+/, '')));
}
main().catch((e) => { console.error(e); process.exit(1); });
