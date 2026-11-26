/**
 * Catálogo de profesiones. Es la fuente única para:
 *  - el buscador del Home
 *  - el Paso 1 del onboarding (los campos de matrícula cambian según la profesión)
 *  - la validación en el servidor (usá este mismo objeto con zod)
 *
 * IMPORTANTE: la nomenclatura de matrículas varía por profesión y por provincia
 * (colegios, consejos, ministerios). Validá estos textos con cada colegio profesional.
 */
export type LicenseType = 'MP' | 'MN' | 'RE';

export type LicenseField = {
  type: LicenseType;
  label: string;
  required: boolean;
  hint?: string;
};

export type Profession = {
  slug: string;
  label: string;
  licenses: LicenseField[];
};

const MP: LicenseField = {
  type: 'MP',
  label: 'Matrícula provincial (M.P.)',
  required: true,
  hint: 'La que figura en tu Colegio de Psicólogos (ej: Colegio de Psicólogos de Santa Fe)',
};

/** ProfesionalesOk está enfocado en psicólogas y psicólogos. Para sumar otra profesión, agregala acá. */
export const PROFESSIONS: Profession[] = [{ slug: 'psicologia', label: 'Psicología', licenses: [MP] }];

/** Profesión por defecto del sitio (hoy la única). */
export const DEFAULT_PROFESSION = 'psicologia';

export const getProfession = (slug: string) => PROFESSIONS.find((p) => p.slug === slug);

export const LICENSE_SHORT: Record<string, string> = { MP: 'M.P.', MN: 'M.N.', RE: 'R.E.' };
