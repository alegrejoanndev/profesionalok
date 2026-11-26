import { z } from 'zod';
import { AGE_GROUP_VALUES, MODALITY_VALUES, cleanCustomOption } from './catalog';
import { DEFAULT_PROFESSION, getProfession } from './professions';
import { SOCIALS, normalizeSocial } from './socials';

export const PROVINCES = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

/**
 * Normaliza un celular argentino al formato que usa WhatsApp (549 + código de área + número).
 * Acepta "3482 440552", "03482-440552", "+54 9 3482 440552", etc. Devuelve null si no es válido.
 */
export function normalizeArPhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  return d.length === 10 ? `549${d}` : null;
}

/**
 * Acepta DNI (7 u 8 dígitos) o CUIT/CUIL (11 dígitos) y devuelve el DNI. El DNI de un CUIT/CUIL son los
 * 8 dígitos del medio (XX-DDDDDDDD-V). No valida el dígito verificador: si está mal, la consulta al
 * registro simplemente no encuentra a la persona. Devuelve '' si está vacío y null si no es válido.
 */
export function parseDocumento(input: string): string | null {
  const d = input.replace(/[.\s-]/g, '');
  if (d === '') return '';
  if (/^\d{7,8}$/.test(d)) return d.replace(/^0+/, '');
  if (/^\d{11}$/.test(d) && ['20', '23', '24', '27'].includes(d.slice(0, 2))) return d.slice(2, 10).replace(/^0+/, '');
  return null;
}

const text = (label: string, min = 2, max = 80) =>
  z.string({ required_error: `Completá ${label}` }).trim().min(min, `Completá ${label}`).max(max, `${label} es demasiado largo`);

/** Paso 1 del onboarding. Se usa igual en el navegador y en el servidor. */
export const onboardingSchema = z
  .object({
    firstName: text('tu nombre', 2, 60),
    lastName: text('tu apellido', 2, 60),
    email: z.string().trim().toLowerCase().email('Ingresá un email válido').max(120),
    phone: z
      .string()
      .trim()
      .refine((v) => normalizeArPhone(v) !== null, 'Ingresá código de área y número, sin 0 ni 15 (ej: 3482 440552)'),
    /** WhatsApp propio (opcional): si se deja vacío, el botón de contacto usa el teléfono de arriba. */
    whatsapp: z
      .string()
      .trim()
      .refine((v) => v === '' || normalizeArPhone(v) !== null, 'Ingresá código de área y número, sin 0 ni 15 (ej: 3482 440552)')
      .optional()
      .default(''),
    instagram: z.string().trim().max(200).optional().default(''),
    facebook: z.string().trim().max(200).optional().default(''),
    linkedin: z.string().trim().max(200).optional().default(''),
    profession: z.string().default(DEFAULT_PROFESSION).refine((s) => !!getProfession(s), 'Profesión no válida'),
    licenses: z.record(z.string(), z.string().trim().max(30)).default({}),
    licenseProvince: z.string().refine((s) => PROVINCES.includes(s), 'Elegí la provincia que emitió tu matrícula'),
    city: text('tu ciudad', 2, 60),
    province: z.string().refine((s) => PROVINCES.includes(s), 'Elegí tu provincia'),
    bio: z.string().trim().max(600, 'Máximo 600 caracteres').optional().default(''),
    /** DNI o CUIT. Solo se usa para consultar el registro oficial de matrículas: no se guarda ni se muestra. */
    dni: z
      .string()
      .trim()
      .transform((v, ctx) => {
        const r = parseDocumento(v);
        if (r === null) {
          ctx.addIssue({ code: 'custom', message: 'Ingresá tu DNI (7 u 8 números) o tu CUIT (11 números), sin puntos ni guiones' });
          return z.NEVER;
        }
        return r;
      })
      .optional()
      .default(''),
    /** Especialidades: las del listado y las que el profesional agrega a mano. */
    specialties: z.array(z.string()).max(14, 'Elegí hasta 14 especialidades').default([]),
    /** Corrientes u orientaciones: las del listado y las que el profesional agrega a mano. */
    corrientes: z.array(z.string()).max(10, 'Elegí hasta 10 corrientes').default([]),
    ageGroups: z.array(z.enum(AGE_GROUP_VALUES)).min(1, 'Elegí al menos un rango etario'),
    modalidad: z.enum(MODALITY_VALUES, { errorMap: () => ({ message: 'Elegí si atendés presencial, online o ambas' }) }),
    obrasSociales: z.array(z.string().trim().min(2).max(60)).max(60, 'Máximo 60 obras sociales').default([]),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Tenés que aceptar los términos para continuar' }) }),
  })
  .superRefine((v, ctx) => {
    const prof = getProfession(v.profession);
    // Se admiten opciones escritas a mano: se limpian y se rechaza lo que no parezca una especialidad.
    for (const k of ['specialties', 'corrientes'] as const) {
      const clean = v[k].map(cleanCustomOption);
      if (clean.some((x) => x === null)) {
        ctx.addIssue({ code: 'custom', path: [k], message: 'Usá solo letras y números, de 2 a 60 caracteres, en cada opción' });
      } else {
        v[k] = [...new Set(clean as string[])];
      }
    }
    // Redes: se acepta el usuario o el enlace y se guarda siempre el enlace https de esa red
    for (const { kind, label } of SOCIALS) {
      const n = normalizeSocial(kind, v[kind]);
      if (n === null) ctx.addIssue({ code: 'custom', path: [kind], message: `Revisá el enlace o el usuario de ${label}` });
      else v[kind] = n;
    }
    for (const lic of prof?.licenses ?? []) {
      const val = (v.licenses[lic.type] ?? '').trim();
      if (lic.required && !val) {
        ctx.addIssue({ code: 'custom', path: ['licenses', lic.type], message: `Ingresá tu ${lic.label}` });
      } else if (val && !/^[A-Za-z0-9./\- ]{1,30}$/.test(val)) {
        ctx.addIssue({ code: 'custom', path: ['licenses', lic.type], message: 'Usá solo letras, números y guiones' });
      }
    }
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const contactSchema = z.object({
  name: text('tu nombre', 2, 80),
  email: z.string().trim().toLowerCase().email('Ingresá un email válido').max(120),
  topic: z.enum(['consulta', 'soporte', 'membresia', 'otro']),
  message: z.string().trim().min(10, 'Contanos un poco más (mínimo 10 caracteres)').max(2000, 'Máximo 2000 caracteres'),
  website: z.string().max(0).optional(), // honeypot: los bots lo completan
});
export type ContactInput = z.infer<typeof contactSchema>;

export const FILE_LIMITS = {
  photo: { maxBytes: 8 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] }, // la foto es opcional
} as const;
