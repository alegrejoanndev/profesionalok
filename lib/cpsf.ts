/**
 * Base de matriculados del Colegio de Psicólogos de la Provincia de Santa Fe.
 *
 * Se toma de data/matriculados.json (generado desde el Excel con scripts/importar-matriculados.py);
 * no se consulta ningún sitio externo. Cada fila es [matrícula, "Apellido y Nombres", localidad].
 * Hay matrículas numéricas ("2254") y con prefijo R ("R6493").
 * Para actualizar la lista: ver README ("Actualizar la lista de matriculados").
 */
import fs from 'node:fs';
import base from '@/data/matriculados.json';

export type CpsfRow = { numero: string; nombre: string; localidad: string };

let index: Map<string, CpsfRow[]> | null = null;

function load(): Map<string, CpsfRow[]> {
  if (index) return index;
  // CPSF_DATA permite apuntar a otro archivo (se usa en las pruebas y en la vista previa, con datos inventados)
  const raw = (process.env.CPSF_DATA ? JSON.parse(fs.readFileSync(process.env.CPSF_DATA, 'utf8')) : base) as [string, string, string][];
  index = new Map();
  for (const [numero, nombre, localidad] of raw) {
    const key = normalizeLicense(numero);
    index.set(key, [...(index.get(key) ?? []), { numero, nombre, localidad }]);
  }
  return index;
}

/** "01234" → "1234"; "r-6493" → "R6493". */
export function normalizeLicense(value: string): string {
  const v = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return /^\d+$/.test(v) ? v.replace(/^0+(?=\d)/, '') : v.replace(/^R0+(?=\d)/, 'R');
}

/** Filas con ese número de matrícula (normalmente una). Si se escribe solo el número y no existe, se prueba con prefijo R. */
export function lookupCpsf(licenseNumber: string): CpsfRow[] {
  const map = load();
  const key = normalizeLicense(licenseNumber);
  const exact = map.get(key);
  if (exact?.length) return exact;
  return /^\d+$/.test(key) ? map.get(`R${key}`) ?? [] : [];
}

/** Cantidad de matriculados cargados. */
export const cpsfTotal = () => [...load().values()].reduce((n, rows) => n + rows.length, 0);

/** Solo para pruebas. */
export function resetCpsfCache() {
  index = null;
}
