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
  hint: 'La que figura en tu colegio o ministerio de salud provincial',
};

export const PROFESSIONS: Profession[] = [
  { slug: 'psicologia', label: 'Psicología', licenses: [MP] },
  {
    slug: 'medicina',
    label: 'Medicina',
    licenses: [
      MP,
      { type: 'MN', label: 'Matrícula nacional (M.N.)', required: false },
      { type: 'RE', label: 'Registro de especialista (R.E.)', required: false, hint: 'Si ofrecés una especialidad' },
    ],
  },
  { slug: 'nutricion', label: 'Nutrición', licenses: [MP] },
  { slug: 'kinesiologia', label: 'Kinesiología y fisioterapia', licenses: [MP] },
  { slug: 'odontologia', label: 'Odontología', licenses: [MP] },
  { slug: 'fonoaudiologia', label: 'Fonoaudiología', licenses: [MP] },
  { slug: 'terapia-ocupacional', label: 'Terapia ocupacional', licenses: [MP] },
  { slug: 'psicopedagogia', label: 'Psicopedagogía', licenses: [MP] },
  { slug: 'obstetricia', label: 'Obstetricia', licenses: [MP] },
  { slug: 'enfermeria', label: 'Enfermería', licenses: [MP] },
];

export const getProfession = (slug: string) => PROFESSIONS.find((p) => p.slug === slug);

export const LICENSE_SHORT: Record<string, string> = { MP: 'M.P.', MN: 'M.N.', RE: 'R.E.' };
