/**
 * Validación automática de matrículas contra el REFEPS (Red Federal de Registros de Profesionales
 * de la Salud, SISA – Ministerio de Salud de la Nación).
 *
 * IMPORTANTE:
 *  - Los servicios web del REFEPS requieren usuario y clave de SISA (SISA_USER / SISA_PASSWORD).
 *    Hay que solicitarlos al SISA: https://sisa.msal.gov.ar (consultas: refeps@msal.gov.ar).
 *  - La estructura de la respuesta está escrita según la documentación pública del SISA y se
 *    interpreta de forma tolerante. Con credenciales reales, corré `npm run matricula:probar`
 *    para ver la respuesta cruda y confirmar que se lee bien antes de salir a producción.
 *  - El registro no tiene cobertura perfecta: que NO aparezca una matrícula no significa que sea
 *    falsa (puede faltar cargarla). Por eso solo se aprueba solo cuando TODO coincide; cualquier
 *    otro resultado queda para revisión manual en /admin. Nunca se rechaza automáticamente.
 *  - SEGURIDAD: el nombre y el número de matrícula son datos públicos; con ellos solos, cualquiera
 *    podría hacerse pasar por un profesional real. Por eso la aprobación automática exige que el DNI
 *    informado coincida con el del registro (MATRICULA_AUTO_APPROVE="dni", el valor por defecto).
 *    Sin DNI el resultado se registra, pero lo aprueba una persona.
 *
 * Modos (MATRICULA_MODE):
 *  - "refeps": consulta el servicio real.
 *  - "mock":   simulador para desarrollo (matrícula que empieza con 9 = verificada, con 0 = no
 *              habilitada, otra = no encontrada). Bloqueado en producción salvo ALLOW_MATRICULA_MOCK=1.
 *  - "off":    sin validación automática (todo pasa a revisión manual).
 */

export type MatriculaStatusValue = 'VERIFIED' | 'MISMATCH' | 'NOT_FOUND' | 'NOT_ENABLED' | 'UNAVAILABLE' | 'NOT_CHECKED';

export type MatriculaInput = {
  firstName: string;
  lastName: string;
  profession: string; // slug de lib/professions.ts
  licenseNumber: string;
  licenseProvince: string;
  /** Solo se usa para consultar; no se guarda ni se registra en ningún log. */
  dni?: string;
  /** Código federal del profesional, si ya se verificó antes (permite revalidar sin DNI). */
  refepsCode?: string | null;
};

export type MatriculaResult = {
  status: MatriculaStatusValue;
  detail: string;
  source: 'REFEPS' | 'MOCK' | 'NONE';
  /** Cómo se identificó a la persona: por DNI (fuerte), por código federal ya verificado (fuerte) o solo por nombre (débil). */
  method?: 'dni' | 'code' | 'name' | 'mock';
  refepsCode?: string;
};

export type RegistryMatricula = { numero: string; profesion: string; provincia: string; habilitada: boolean | null };
export type RegistryRecord = { apellido: string; nombre: string; codigo?: string; matriculas: RegistryMatricula[] };

// ───────────────────────── Selección de modo ─────────────────────────

export type MatriculaMode = 'refeps' | 'mock' | 'off';

export function matriculaMode(): MatriculaMode {
  const mode = (process.env.MATRICULA_MODE ?? 'off').toLowerCase();
  if (mode === 'refeps' && process.env.SISA_USER && process.env.SISA_PASSWORD) return 'refeps';
  if (mode === 'mock' && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_MATRICULA_MOCK === '1')) return 'mock';
  return 'off';
}

// ───────────────────────── Normalización y comparación ─────────────────────────

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
const tokens = (s: string) => norm(s).split(' ').filter((t) => t && !STOP.has(t));

/** "García López" coincide con "GARCIA LOPEZ" y con "García"; "Pérez" NO coincide con "Gómez". */
export function surnameMatches(mine: string, theirs: string) {
  const a = tokens(mine);
  const b = tokens(theirs);
  if (!a.length || !b.length) return false;
  return a.every((t) => b.includes(t)) || b.every((t) => a.includes(t));
}

/** Alcanza con que coincida al menos un nombre ("Ana María" coincide con "Ana"). */
export function firstNameMatches(mine: string, theirs: string) {
  const b = tokens(theirs);
  return tokens(mine).some((t) => b.includes(t));
}

const licNorm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
/** "4821" coincide con "04821", "MP 4821" y "M.P. 4821", pero no con "48210". */
export function licenseMatches(mine: string, theirs: string) {
  const a = licNorm(mine).replace(/^0+/, '');
  const b = licNorm(theirs);
  if (!a || !b) return false;
  const bTrim = b.replace(/^0+/, '');
  if (a === bTrim) return true;
  return b.endsWith(a) && /^[A-Z]*0*$/.test(b.slice(0, b.length - a.length));
}

const PROFESSION_KEYWORDS: Record<string, string[]> = {
  psicologia: ['psicolog'],
  medicina: ['medic'],
  nutricion: ['nutri'],
  kinesiologia: ['kinesi', 'fisioterap'],
  odontologia: ['odont'],
  fonoaudiologia: ['fonoaudi'],
  'terapia-ocupacional': ['ocupacional'],
  psicopedagogia: ['psicopedag'],
  obstetricia: ['obstet'],
  enfermeria: ['enfermer'],
};

export function professionMatches(slug: string, registryName: string) {
  const n = norm(registryName);
  return (PROFESSION_KEYWORDS[slug] ?? []).some((k) => n.includes(k));
}

function provinceKey(s: string) {
  const n = norm(s);
  if (n === 'caba' || n.includes('ciudad autonoma') || n.includes('capital federal') || n === 'ciudad de buenos aires') return 'caba';
  if (n.startsWith('tierra del fuego')) return 'tierra del fuego';
  return n;
}
export const provinceMatches = (mine: string, theirs: string) => provinceKey(mine) === provinceKey(theirs);

// ───────────────────────── Evaluación (función pura, 100 % probada) ─────────────────────────

export function evaluateRecords(records: RegistryRecord[], input: MatriculaInput): Omit<MatriculaResult, 'source'> {
  const isMe = (r: RegistryRecord) => surnameMatches(input.lastName, r.apellido) && firstNameMatches(input.firstName, r.nombre);
  const hasLicense = (m: RegistryMatricula) => licenseMatches(input.licenseNumber, m.numero);

  const persons = records.filter(isMe);
  if (persons.length === 0) {
    const someoneElse = records.some((r) => r.matriculas.some(hasLicense));
    return someoneElse
      ? { status: 'MISMATCH', detail: 'Esa matrícula figura a nombre de otra persona en el registro oficial.' }
      : { status: 'NOT_FOUND', detail: 'No encontramos a la persona ni la matrícula en el registro oficial.' };
  }

  const mine = persons.flatMap((r) => r.matriculas.filter(hasLicense).map((m) => ({ r, m })));
  if (mine.length === 0) {
    return { status: 'NOT_FOUND', detail: 'La persona figura en el registro, pero no con ese número de matrícula.' };
  }

  const scored = mine
    .map(({ r, m }) => ({
      r,
      m,
      prof: professionMatches(input.profession, m.profesion),
      prov: provinceMatches(input.licenseProvince, m.provincia),
    }))
    .sort((x, y) => Number(y.prof) + Number(y.prov) - (Number(x.prof) + Number(x.prov)));

  const ok = scored.find((c) => c.prof && c.prov && c.m.habilitada === true);
  if (ok) return { status: 'VERIFIED', detail: 'Matrícula habilitada y datos coincidentes con el registro oficial.', refepsCode: ok.r.codigo };

  const best = scored[0];
  if (best.prof && best.prov) {
    return best.m.habilitada === false
      ? { status: 'NOT_ENABLED', detail: 'El registro oficial informa que la matrícula NO está habilitada.', refepsCode: best.r.codigo }
      : { status: 'MISMATCH', detail: 'No pudimos confirmar si la matrícula está habilitada.', refepsCode: best.r.codigo };
  }
  if (!best.prof) return { status: 'MISMATCH', detail: 'La matrícula corresponde a otra profesión en el registro oficial.' };
  return { status: 'MISMATCH', detail: 'La matrícula fue emitida por otra provincia en el registro oficial.' };
}

// ───────────────────────── Lectura tolerante de la respuesta de SISA ─────────────────────────

type Obj = Record<string, unknown>;
const asArray = (x: unknown): unknown[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const pick = (o: Obj, ...keys: string[]) => {
  for (const k of keys) {
    const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
    if (hit && o[hit] != null && o[hit] !== '') return o[hit];
  }
  return undefined;
};
const str = (v: unknown) => (v == null ? '' : String(v));

function parseEnabled(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v == null || v === '') return null;
  const n = norm(String(v));
  if (/\b(no habilitad|inhabilitad|suspendid|cancelad|baja|inactiv|vencid)/.test(n)) return false;
  if (/\b(habilitad|activ|vigente)/.test(n)) return true;
  return null;
}

/** Devuelve un texto de error si la respuesta indica credenciales inválidas u otro problema del servicio. */
export function sisaServiceError(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as Obj;
  const inner = (pick(root, 'Profesional', 'profesional') as Obj | undefined) ?? root;
  const resultado = str(pick(inner as Obj, 'resultado', 'mensaje', 'error') ?? pick(root, 'resultado', 'mensaje', 'error'));
  if (/(usuario|clave|credencial|autoriz|autentic|permiso|acceso)/.test(norm(resultado))) return resultado;
  return null;
}

export function parseSisaResponse(json: unknown): RegistryRecord[] {
  if (!json || typeof json !== 'object') return [];
  const root = json as Obj;
  const node = pick(root, 'Profesional', 'profesionales', 'profesional', 'resultado') ?? root;
  const out: RegistryRecord[] = [];

  for (const raw of asArray(node)) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Obj;
    const mats = asArray(pick(p, 'matricula', 'matriculas', 'matriculaProfesional'));
    const matriculas: RegistryMatricula[] = [];
    for (const m of mats) {
      if (!m || typeof m !== 'object') continue;
      const o = m as Obj;
      const numero = str(pick(o, 'matricula', 'numero', 'nroMatricula', 'numeroMatricula'));
      if (!numero) continue;
      matriculas.push({
        numero,
        profesion: str(pick(o, 'profesion', 'nombreProfesion', 'nombre')),
        provincia: str(pick(o, 'provincia', 'jurisdiccion', 'provinciaMatriculacion')),
        habilitada: parseEnabled(pick(o, 'estado', 'situacion', 'situacionMatricula', 'habilitada', 'estadoMatricula')),
      });
    }
    const apellido = str(pick(p, 'apellido'));
    if (!apellido && matriculas.length === 0) continue;
    out.push({
      apellido,
      nombre: str(pick(p, 'nombre', 'nombres')),
      codigo: str(pick(p, 'codigo', 'codigoFederal', 'codigoProfesional')) || undefined,
      matriculas,
    });
  }
  return out;
}

// ───────────────────────── Consulta al servicio de SISA ─────────────────────────

const SISA_BASE = () => process.env.SISA_API_URL ?? 'https://sisa.msal.gov.ar';
const timeoutMs = () => Number(process.env.SISA_TIMEOUT_MS ?? 8000);

type Fetched = { ok: true; json: unknown } | { ok: false; reason: string };

export async function sisaGet(endpoint: 'obtener' | 'buscar', params: Record<string, string>): Promise<Fetched> {
  const qs = new URLSearchParams({ usuario: process.env.SISA_USER!, clave: process.env.SISA_PASSWORD!, ...params });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs());
  try {
    const res = await fetch(`${SISA_BASE()}/sisa/services/rest/profesional/${endpoint}?${qs}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'El registro rechazó las credenciales de SISA' };
    if (!res.ok) return { ok: false, reason: `El registro respondió con error ${res.status}` };
    const json = await res.json().catch(() => null);
    if (json == null) return { ok: false, reason: 'El registro devolvió una respuesta ilegible' };
    const serviceError = sisaServiceError(json);
    if (serviceError) return { ok: false, reason: `El registro informó: ${serviceError}` };
    return { ok: true, json };
  } catch (err) {
    // Nunca se incluye la URL en el mensaje: contiene usuario, clave y DNI.
    const timedOut = (err as Error).name === 'AbortError';
    return { ok: false, reason: timedOut ? 'El registro no respondió a tiempo' : 'No pudimos conectarnos con el registro' };
  } finally {
    clearTimeout(timer);
  }
}

type Attempt = { result: MatriculaResult } | { error: string };

async function attempt(fetcher: () => Promise<Fetched>, input: MatriculaInput, method: 'dni' | 'code' | 'name'): Promise<Attempt> {
  const res = await fetcher();
  if (!res.ok) return { error: res.reason };
  return { result: { ...evaluateRecords(parseSisaResponse(res.json), input), source: 'REFEPS', method } };
}

async function validateWithRefeps(input: MatriculaInput): Promise<MatriculaResult> {
  const unavailable = (reason: string): MatriculaResult => ({
    status: 'UNAVAILABLE',
    detail: `${reason || 'No pudimos consultar el registro oficial'}. Queda para revisión manual.`,
    source: 'REFEPS',
  });
  let lastError = '';

  // 1) Código federal (perfil ya verificado antes): permite revalidar sin pedir el DNI de nuevo.
  if (input.refepsCode) {
    const a = await attempt(() => sisaGet('obtener', { codigo: input.refepsCode! }), input, 'code');
    if ('result' in a) return a.result;
    lastError = a.error;
  }

  // 2) DNI informado: es la única fuente válida. NUNCA se cae a una búsqueda más débil,
  //    porque alguien podría informar un DNI ajeno y verificarse igual por nombre + matrícula.
  if (input.dni) {
    const a = await attempt(() => sisaGet('obtener', { nrodoc: input.dni! }), input, 'dni');
    return 'result' in a ? a.result : unavailable(a.error);
  }

  // 3) Sin DNI: apellido + matrícula. Sirve para informar a quien revisa, pero no para aprobar solo.
  const a = await attempt(() => sisaGet('buscar', { apellido: input.lastName, matricula: input.licenseNumber }), input, 'name');
  return 'result' in a ? a.result : unavailable(a.error || lastError);
}

function validateWithMock(input: MatriculaInput): MatriculaResult {
  const first = input.licenseNumber.trim()[0];
  if (first === '9') return { status: 'VERIFIED', detail: 'Verificada en modo de prueba (simulador).', source: 'MOCK', method: 'mock', refepsCode: `MOCK-${licNorm(input.licenseNumber)}` };
  if (first === '0') return { status: 'NOT_ENABLED', detail: 'Simulador: matrícula no habilitada.', source: 'MOCK' };
  return { status: 'NOT_FOUND', detail: 'Simulador: la matrícula no figura en el registro.', source: 'MOCK' };
}

/** Punto de entrada. Nunca lanza error: ante cualquier problema devuelve UNAVAILABLE (→ revisión manual). */
export async function validateMatricula(input: MatriculaInput): Promise<MatriculaResult> {
  try {
    switch (matriculaMode()) {
      case 'refeps':
        return await validateWithRefeps(input);
      case 'mock':
        return validateWithMock(input);
      default:
        return { status: 'NOT_CHECKED', detail: 'La validación automática no está activada. Revisión manual.', source: 'NONE' };
    }
  } catch {
    return { status: 'UNAVAILABLE', detail: 'Error inesperado al validar. Queda para revisión manual.', source: 'NONE' };
  }
}
