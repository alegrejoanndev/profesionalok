import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { professionals } from '@/db/schema';
import { LOCALITY_SUGGESTIONS, parseZonas } from './catalog';
import { getDb, hasDatabase } from './db';

/** Solo estos campos son públicos. NUNCA expongas email, titleDocPath, regularizeToken, etc. */
export type PublicProfessional = {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  profession: string; // slug de lib/professions.ts
  city: string;
  province: string;
  licenseType: string;
  licenseNumber: string;
  photoUrl: string | null;
  phone: string; // solo dígitos, formato internacional (ej: 5493482...)
  specialties: string[];
  corrientes: string[];
  ageGroups: string[];
  modalidad: string; // PRESENCIAL | ONLINE | AMBAS
  obrasSociales: string[];
};

const publicColumns = {
  id: professionals.id,
  slug: professionals.slug,
  firstName: professionals.firstName,
  lastName: professionals.lastName,
  profession: professionals.profession,
  city: professionals.city,
  province: professionals.province,
  licenseType: professionals.licenseType,
  licenseNumber: professionals.licenseNumber,
  photoUrl: professionals.photoUrl,
  phone: professionals.phone,
  specialties: professionals.specialties,
  corrientes: professionals.corrientes,
  ageGroups: professionals.ageGroups,
  modalidad: professionals.modalidad,
  obrasSociales: professionals.obrasSociales,
};

/**
 * Regla de visibilidad pública (una sola definición, usala en todas las consultas):
 * suscripción al día + título aprobado + sin borrado lógico.
 */
export const publicWhere = () =>
  and(eq(professionals.status, 'ACTIVE'), eq(professionals.verificationStatus, 'APPROVED'), isNull(professionals.deletedAt));

// Datos FICTICIOS para ver el diseño sin base de datos. Se usan solo si no hay DATABASE_URL.
type DemoExtra = Pick<PublicProfessional, 'specialties' | 'corrientes' | 'ageGroups' | 'modalidad' | 'obrasSociales'>;
const mk = (
  n: number, firstName: string, lastName: string, profession: string, city: string, extra: DemoExtra,
): PublicProfessional => ({
  id: `demo-${n}`, slug: `demo-${n}`, firstName, lastName, profession, city, province: 'Santa Fe',
  licenseType: 'MP', licenseNumber: String(1000 + n * 137), photoUrl: null, phone: `54934820000${n}0`, ...extra,
});
const DEMO: PublicProfessional[] = [
  mk(1, 'Lucía', 'Fernández', 'psicologia', 'Reconquista', {
    specialties: ['Psicología clínica', 'Ansiedad y estrés'], corrientes: ['Cognitivo-conductual (TCC)'],
    ageGroups: ['adolescentes', 'adultos'], modalidad: 'AMBAS', obrasSociales: ['IAPOS (Santa Fe)', 'OSDE', 'Particular (sin obra social)'],
  }),
  mk(2, 'Martín', 'Gómez', 'kinesiologia', 'Romang', {
    specialties: ['Traumatológica', 'Deportiva'], corrientes: [],
    ageGroups: ['adolescentes', 'adultos'], modalidad: 'PRESENCIAL', obrasSociales: ['PAMI', 'IAPOS (Santa Fe)'],
  }),
  mk(3, 'Carolina', 'Ruiz', 'nutricion', 'Villa Ocampo', {
    specialties: ['Nutrición clínica', 'Nutrición infantil'], corrientes: [],
    ageGroups: ['ninos', 'adolescentes', 'adultos'], modalidad: 'ONLINE', obrasSociales: ['Particular (sin obra social)'],
  }),
  mk(4, 'Julián', 'Acosta', 'odontologia', 'Reconquista', {
    specialties: ['Odontopediatría', 'Ortodoncia'], corrientes: [],
    ageGroups: ['ninos', 'adolescentes'], modalidad: 'PRESENCIAL', obrasSociales: ['IAPOS (Santa Fe)', 'Sancor Salud', 'Swiss Medical'],
  }),
  mk(5, 'Sofía', 'Benítez', 'psicologia', 'Avellaneda', {
    specialties: ['Infancia y adolescencia', 'Terapia familiar'], corrientes: ['Sistémica', 'Psicoanalítica'],
    ageGroups: ['ninos', 'adolescentes'], modalidad: 'AMBAS', obrasSociales: ['Incluir Salud', 'Particular (sin obra social)'],
  }),
  mk(6, 'Andrés', 'Molina', 'medicina', 'Villa Ocampo', {
    specialties: ['Clínica médica', 'Geriatría'], corrientes: [],
    ageGroups: ['adultos'], modalidad: 'PRESENCIAL', obrasSociales: ['PAMI', 'IAPOS (Santa Fe)', 'OSECAC (Empleados de Comercio)'],
  }),
];

/** Quita tildes y pasa a minúsculas, para que "cordoba" encuentre "Córdoba". */
export const normalizeText = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** El mismo normalizado, pero en SQL (sin necesitar la extensión unaccent). */
const sqlNorm = (col: unknown) =>
  sql`translate(lower(${col}), 'áéíóúüñàèìòù', 'aeiouunaeiou')`;

export async function getFeaturedProfessionals(limit = 4): Promise<PublicProfessional[]> {
  if (!hasDatabase()) return DEMO.slice(0, limit);
  try {
    return await getDb()
      .select(publicColumns)
      .from(professionals)
      .where(and(publicWhere(), eq(professionals.isFeatured, true)))
      .orderBy(desc(professionals.updatedAt))
      .limit(limit);
  } catch (err) {
    // El Inicio no debe caerse si la base no responde: se muestra sin destacados y se registra el problema.
    console.error('[home] no se pudieron leer los destacados:', err);
    return [];
  }
}

export type SearchParams = {
  profesion?: string;
  especialidad?: string;
  edad?: string;
  corriente?: string;
  obra?: string;
  modalidad?: string; // 'PRESENCIAL' | 'ONLINE' (los que atienden "ambas" aparecen en los dos)
  zona?: string; // una o varias localidades separadas por coma: "Romang, Villa Ocampo"
  page?: number;
  pageSize?: number;
};

const has = (col: unknown, value: string) => sql`${col} @> ${JSON.stringify([value])}::jsonb`;

export async function searchProfessionals({
  profesion, especialidad, edad, corriente, obra, modalidad, zona, page = 1, pageSize = 12,
}: SearchParams) {
  const zonas = parseZonas(zona).map(normalizeText);

  if (!hasDatabase()) {
    const all = DEMO.filter(
      (p) =>
        (!profesion || p.profession === profesion) &&
        (!especialidad || p.specialties.includes(especialidad)) &&
        (!edad || p.ageGroups.includes(edad)) &&
        (!corriente || p.corrientes.includes(corriente)) &&
        (!obra || p.obrasSociales.includes(obra)) &&
        (!modalidad || p.modalidad === 'AMBAS' || p.modalidad === modalidad) &&
        (!zonas.length || zonas.some((z) => normalizeText(`${p.city} ${p.province}`).includes(z))),
    );
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, demo: true };
  }

  const likes = zonas.map((z) => `%${z.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const where = and(
    publicWhere(),
    profesion ? eq(professionals.profession, profesion) : undefined,
    especialidad ? has(professionals.specialties, especialidad) : undefined,
    edad ? has(professionals.ageGroups, edad) : undefined,
    corriente ? has(professionals.corrientes, corriente) : undefined,
    obra ? has(professionals.obrasSociales, obra) : undefined,
    modalidad ? inArray(professionals.modalidad, [modalidad, 'AMBAS']) : undefined,
    likes.length
      ? or(
          ...likes.flatMap((like) => [
            sql`${sqlNorm(professionals.city)} like ${like}`,
            sql`${sqlNorm(professionals.province)} like ${like}`,
          ]),
        )
      : undefined,
  );

  const db = getDb();
  const [items, [{ total }]] = await Promise.all([
    db
      .select(publicColumns)
      .from(professionals)
      .where(where)
      // Orden alfabético estable: no hay "mejor valorados" ni destacados primero en el directorio
      .orderBy(professionals.lastName, professionals.firstName)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(professionals).where(where),
  ]);
  return { items, total, demo: false };
}

/** Localidades para sugerir en el buscador: las de los perfiles publicados + una lista base. */
export async function getLocalitySuggestions(): Promise<string[]> {
  let fromDb: string[] = [];
  if (hasDatabase()) {
    try {
      const rows = await getDb().selectDistinct({ city: professionals.city }).from(professionals).where(publicWhere()).limit(200);
      fromDb = rows.map((r) => r.city);
    } catch {
      /* si la base no responde, alcanza con la lista base */
    }
  }
  const seen = new Set<string>();
  return [...fromDb, ...LOCALITY_SUGGESTIONS]
    .filter((c) => {
      const k = normalizeText(c);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'es'));
}

/** slug legible y único: ana-perez-4821 */
export function makeSlug(firstName: string, lastName: string, license: string) {
  const base = normalizeText(`${firstName} ${lastName}`).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tail = license.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8);
  return [base, tail, Math.random().toString(36).slice(2, 6)].filter(Boolean).join('-');
}
