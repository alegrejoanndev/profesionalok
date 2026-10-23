/**
 * Catálogos del perfil y del buscador: rangos etarios, modalidad de atención, especialidades por profesión,
 * corrientes (orientaciones) y obras sociales. Es la fuente única para el formulario, el buscador, la
 * validación del servidor y las tarjetas. Para agregar una opción, sumala acá: no hay que tocar nada más.
 */

// ───────────── Rango etario ─────────────
export const AGE_GROUPS = [
  { value: 'ninos', label: 'Niños', hint: 'hasta 12 años' },
  { value: 'adolescentes', label: 'Adolescentes', hint: '13 a 17 años' },
  { value: 'adultos', label: 'Adultos', hint: '18 años o más' },
] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number]['value'];
export const AGE_GROUP_VALUES = AGE_GROUPS.map((a) => a.value) as [AgeGroup, ...AgeGroup[]];
export const ageLabel = (v: string) => AGE_GROUPS.find((a) => a.value === v)?.label ?? v;

// ───────────── Modalidad de atención: presencial, online o ambas ─────────────
export const MODALITIES = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'AMBAS', label: 'Presencial y online' },
] as const;
export type Modality = (typeof MODALITIES)[number]['value'];
export const MODALITY_VALUES = MODALITIES.map((m) => m.value) as [Modality, ...Modality[]];
export const modalityLabel = (v: string) => MODALITIES.find((m) => m.value === v)?.label ?? v;

// ───────────── Especialidades (se puede elegir más de una) ─────────────
export const SPECIALTIES: Record<string, string[]> = {
  psicologia: [
    'Psicología clínica', 'Infancia y adolescencia', 'Terapia de pareja', 'Terapia familiar', 'Ansiedad y estrés',
    'Depresión', 'Duelo y pérdidas', 'Trauma y estrés postraumático', 'Adicciones', 'Trastornos de la alimentación',
    'Neuropsicología', 'Psicología forense', 'Psicología laboral', 'Psicología educacional', 'Sexología',
    'Psicooncología', 'Orientación vocacional', 'Psicología deportiva',
  ],
  medicina: [
    'Clínica médica', 'Medicina general y familiar', 'Pediatría', 'Ginecología', 'Cardiología', 'Dermatología',
    'Traumatología', 'Neurología', 'Psiquiatría', 'Endocrinología', 'Gastroenterología', 'Oftalmología',
    'Otorrinolaringología', 'Urología', 'Neumonología', 'Reumatología', 'Geriatría', 'Medicina del deporte',
  ],
  nutricion: [
    'Nutrición clínica', 'Nutrición deportiva', 'Descenso de peso y obesidad', 'Nutrición infantil', 'Diabetes',
    'Trastornos de la conducta alimentaria', 'Alimentación vegetariana y vegana', 'Embarazo y lactancia',
    'Celiaquía e intolerancias',
  ],
  kinesiologia: [
    'Traumatológica', 'Deportiva', 'Neurológica', 'Respiratoria', 'Pediátrica', 'Suelo pélvico', 'Posturología (RPG)',
    'Geriátrica', 'Drenaje linfático',
  ],
  odontologia: [
    'Odontología general', 'Ortodoncia', 'Endodoncia', 'Implantes', 'Odontopediatría', 'Periodoncia',
    'Cirugía bucomaxilofacial', 'Estética dental', 'Prótesis',
  ],
  fonoaudiologia: [
    'Lenguaje infantil', 'Voz', 'Audiología', 'Deglución', 'Trastornos del aprendizaje', 'Fluidez (tartamudez)',
    'Motricidad orofacial', 'Rehabilitación del habla en adultos',
  ],
  'terapia-ocupacional': [
    'Neurodesarrollo y TEA', 'Integración sensorial', 'Rehabilitación física', 'Salud mental', 'Geriatría',
    'Terapia de mano',
  ],
  psicopedagogia: [
    'Dificultades de aprendizaje', 'Orientación escolar', 'Neurodesarrollo', 'Evaluación psicopedagógica', 'Apoyo escolar',
  ],
  obstetricia: [
    'Control prenatal', 'Preparación para el parto', 'Posparto y lactancia', 'Salud sexual y reproductiva',
  ],
  enfermeria: [
    'Enfermería a domicilio', 'Cuidados geriátricos', 'Curaciones', 'Cuidados pediátricos', 'Inyectables y vacunación',
    'Cuidados paliativos',
  ],
};
export const specialtiesFor = (profession: string) => SPECIALTIES[profession] ?? [];
export const ALL_SPECIALTIES = [...new Set(Object.values(SPECIALTIES).flat())];

// ───────────── Corrientes (orientaciones teóricas). Hoy solo aplican a Psicología ─────────────
export const APPROACHES: Record<string, string[]> = {
  psicologia: [
    'Cognitivo-conductual (TCC)', 'Psicoanalítica', 'Psicoanálisis lacaniano', 'Sistémica', 'Gestalt', 'Humanista',
    'Integrativa', 'Terapia de aceptación y compromiso (ACT)', 'EMDR', 'Psicodrama', 'Junguiana',
    'Terapia breve estratégica', 'Basada en mindfulness', 'Centrada en la persona',
  ],
};
export const approachesFor = (profession: string) => APPROACHES[profession] ?? [];
export const ALL_APPROACHES = [...new Set(Object.values(APPROACHES).flat())];

// ───────────── Obras sociales y prepagas ─────────────
export const PARTICULAR = 'Particular (sin obra social)';
export const OBRAS_SOCIALES = [
  PARTICULAR,
  'PAMI', 'IAPOS (Santa Fe)', 'Incluir Salud', 'IOMA (Buenos Aires)', 'APROSS (Córdoba)', 'OSEP (Mendoza)',
  'INSSSEP (Corrientes)', 'IOSFA (Fuerzas Armadas y de Seguridad)', 'OSPJN (Poder Judicial de la Nación)',
  'OSDE', 'Swiss Medical', 'Galeno', 'Medifé', 'Sancor Salud', 'Omint', 'Jerárquicos Salud', 'Accord Salud',
  'Federada Salud', 'Prevención Salud', 'Avalian', 'Medicus', 'Hospital Italiano (Plan de Salud)', 'ACA Salud',
  'OSECAC (Empleados de Comercio)', 'Unión Personal', 'OSPLAD (Docentes)', 'OSDEPYM', 'OSUTHGRA', 'OSPACA',
  'Obra Social Bancaria', 'OSMATA (Mecánicos)', 'UOM (Metalúrgicos)', 'OSSEG (Seguros)', 'Sanidad (ATSA)',
  'OSPRERA (Trabajadores rurales)', 'Luis Pasteur', 'Premedic', 'DOSUBA',
];

// ───────────── Localidades sugeridas en el buscador (se puede escribir cualquier otra) ─────────────
export const LOCALITY_SUGGESTIONS = [
  'Reconquista', 'Avellaneda', 'Romang', 'Villa Ocampo', 'Las Toscas', 'Villa Ana', 'Guadalupe Norte', 'Vera',
  'Tostado', 'Calchaquí', 'San Javier', 'Esperanza', 'Rafaela', 'Santa Fe', 'Rosario', 'Venado Tuerto',
  'Resistencia', 'Corrientes', 'Paraná',
];

// ───────────── Zona con varias localidades: "Romang, Villa Ocampo" ─────────────
/** Separa por coma, punto y coma, barra o " y ". Máximo 6 términos de 2+ letras. */
export function parseZonas(input: string | undefined | null): string[] {
  if (!input) return [];
  return [
    ...new Set(
      input
        .split(/[,;/\n]|\s+y\s+/i)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2),
    ),
  ].slice(0, 6);
}
