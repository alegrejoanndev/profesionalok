/**
 * Padrón de matriculados del Colegio de Psicólogos de la Provincia de Santa Fe (CPSF):
 * https://www.cpsf.org.ar/matriculados
 *
 * El sitio no tiene una API: publica el listado en una tabla paginada de 25 filas
 * (Mat. Nº | Apellido y Nombres | Localidad | Observación | O. Social) en /matriculados/0, /25, /50…
 * Esta función lee ese listado completo, lo guarda en memoria (y en la base de datos, si hay) y
 * consulta contra esa copia, así cada alta no depende de recorrer 200 páginas.
 *
 * IMPORTANTE: el lector del HTML es tolerante (busca filas de tabla cuya primera celda es un número),
 * pero se escribió sin poder abrir el sitio real. Corré `npm run cpsf:probar` una vez para ver qué lee
 * y confirmar que trae filas antes de salir a producción.
 */
import { eq } from 'drizzle-orm';
import { cpsfSnapshot } from '@/db/schema';
import { getDb, hasDatabase } from './db';

export type CpsfRow = { numero: string; nombre: string; localidad: string; observacion: string; obraSocial: string };

const BASE = () => (process.env.CPSF_URL ?? 'https://www.cpsf.org.ar/matriculados').replace(/\/+$/, '');
const PAGE_SIZE = 25;
const MAX_PAGES = Number(process.env.CPSF_MAX_PAGES ?? 800);
const CONCURRENCY = 6;
const TTL_MS = Number(process.env.CPSF_TTL_HOURS ?? 24) * 3600 * 1000;
const timeoutMs = () => Number(process.env.CPSF_TIMEOUT_MS ?? 15000);

// ───────────────────────── Lectura del HTML ─────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ' };

function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m);
}
const clean = (cell: string) => decode(cell.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Extrae las filas del listado: toda <tr> cuya primera celda es un número de matrícula y que trae un nombre. */
export function parseCpsfHtml(html: string): CpsfRow[] {
  const rows: CpsfRow[] = [];
  for (const tr of html.match(/<tr[\s>][\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...tr.matchAll(/<t[dh][\s>][\s\S]*?<\/t[dh]>/gi)].map((m) => clean(m[0].replace(/^<t[dh][^>]*>/i, '')));
    if (cells.length < 2) continue;
    const numero = cells[0].replace(/[^0-9A-Za-z]/g, '');
    if (!/^\d{1,7}$/.test(numero) || cells[1].length < 3) continue;
    rows.push({
      numero: numero.replace(/^0+(?=\d)/, ''),
      nombre: cells[1],
      localidad: cells[2] ?? '',
      observacion: cells[3] ?? '',
      obraSocial: cells[4] ?? '',
    });
  }
  return rows;
}

async function fetchPage(offset: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs());
  try {
    const res = await fetch(offset === 0 ? BASE() : `${BASE()}/${offset}`, {
      signal: ctrl.signal,
      headers: { Accept: 'text/html', 'User-Agent': 'ProfesionalesOk/1.0 (verificacion de matriculas)' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`El Colegio respondió con error ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Recorre todas las páginas del padrón. Corta cuando una página viene vacía o repite la anterior. */
export async function crawlCpsf(): Promise<CpsfRow[]> {
  const first = parseCpsfHtml(await fetchPage(0));
  if (first.length === 0) throw new Error('No pudimos leer filas en la página del Colegio (¿cambió el formato?)');
  const byNumber = new Map<string, CpsfRow>(first.map((r) => [r.numero, r]));

  const firstKey = first[0].numero + first[0].nombre;
  let next = PAGE_SIZE;
  let done = false;
  async function worker() {
    while (!done) {
      const offset = next;
      next += PAGE_SIZE;
      if (offset / PAGE_SIZE >= MAX_PAGES) return;
      const rows = parseCpsfHtml(await fetchPage(offset));
      // Algunos sitios devuelven la primera página al pedir un salto fuera de rango
      if (rows.length === 0 || rows[0].numero + rows[0].nombre === firstKey) {
        done = true;
        return;
      }
      for (const r of rows) byNumber.set(r.numero, r);
      if (rows.length < PAGE_SIZE) done = true;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return [...byNumber.values()];
}

// ───────────────────────── Copia del padrón (memoria + base de datos) ─────────────────────────

type Snapshot = { fetchedAt: number; rows: Map<string, CpsfRow[]> };
const g = globalThis as unknown as { __cpsf?: Snapshot; __cpsfLoading?: Promise<Snapshot | null> };

function index(rows: CpsfRow[], fetchedAt: number): Snapshot {
  const map = new Map<string, CpsfRow[]>();
  for (const r of rows) map.set(r.numero, [...(map.get(r.numero) ?? []), r]);
  return { fetchedAt, rows: map };
}

async function loadFromDb(): Promise<Snapshot | null> {
  if (!hasDatabase()) return null;
  try {
    const [row] = await getDb().select().from(cpsfSnapshot).where(eq(cpsfSnapshot.id, 1)).limit(1);
    return row ? index(row.records as CpsfRow[], row.fetchedAt.getTime()) : null;
  } catch {
    return null;
  }
}

async function saveToDb(rows: CpsfRow[]) {
  if (!hasDatabase()) return;
  try {
    await getDb()
      .insert(cpsfSnapshot)
      .values({ id: 1, records: rows, total: rows.length, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: cpsfSnapshot.id, set: { records: rows, total: rows.length, fetchedAt: new Date() } });
  } catch {
    /* la copia en base es opcional */
  }
}

/** Vuelve a leer el padrón completo del sitio del Colegio y guarda la copia. */
export async function refreshCpsf(): Promise<{ total: number }> {
  const rows = await crawlCpsf();
  g.__cpsf = index(rows, Date.now());
  await saveToDb(rows);
  return { total: rows.length };
}

/** Copia vigente del padrón: memoria → base de datos → sitio del Colegio. null si no se pudo obtener ninguna. */
async function getSnapshot(): Promise<Snapshot | null> {
  if (g.__cpsf && Date.now() - g.__cpsf.fetchedAt < TTL_MS) return g.__cpsf;
  if (!g.__cpsfLoading) {
    g.__cpsfLoading = (async () => {
      const fromDb = await loadFromDb();
      if (fromDb && Date.now() - fromDb.fetchedAt < TTL_MS) return (g.__cpsf = fromDb);
      try {
        await refreshCpsf();
        return g.__cpsf!;
      } catch {
        // Si el sitio no responde, una copia vencida sigue siendo mejor que nada
        return g.__cpsf ?? fromDb ?? null;
      }
    })().finally(() => {
      g.__cpsfLoading = undefined;
    });
  }
  return g.__cpsfLoading;
}

/** Solo para pruebas. */
export function resetCpsfCache() {
  g.__cpsf = undefined;
  g.__cpsfLoading = undefined;
}

export type CpsfLookup = { available: false } | { available: true; rows: CpsfRow[] };

/** Filas del padrón con ese número de matrícula (normalmente una). */
export async function lookupCpsf(licenseNumber: string): Promise<CpsfLookup> {
  const snap = await getSnapshot();
  if (!snap) return { available: false };
  const key = licenseNumber.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  return { available: true, rows: snap.rows.get(key) ?? [] };
}
