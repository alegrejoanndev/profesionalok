import { z } from 'zod';
import { AGE_GROUP_VALUES, MODALITY_VALUES, approachesFor, specialtiesFor } from './catalog';
import { getProfession } from './professions';

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
    profession: z.string().refine((s) => !!getProfession(s), 'Elegí tu especialidad'),
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
    /** Especialidades (se puede elegir más de una). */
    specialties: z.array(z.string().trim().max(60)).max(12, 'Elegí hasta 12 especialidades').default([]),
    /** Corrientes u orientaciones (hoy solo Psicología). */
    corrientes: z.array(z.string().trim().max(60)).max(8, 'Elegí hasta 8 corrientes').default([]),
    ageGroups: z.array(z.enum(AGE_GROUP_VALUES)).min(1, 'Elegí al menos un rango etario'),
    modalidad: z.enum(MODALITY_VALUES, { errorMap: () => ({ message: 'Elegí si atendés presencial, online o ambas' }) }),
    obrasSociales: z.array(z.string().trim().min(2).max(60)).max(60, 'Máximo 60 obras sociales').default([]),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Tenés que aceptar los términos para continuar' }) }),
  })
  .superRefine((v, ctx) => {
    const prof = getProfession(v.profession);
    const okSpecs = specialtiesFor(v.profession);
    if (v.specialties.some((x) => !okSpecs.includes(x))) {
      ctx.addIssue({ code: 'custom', path: ['specialties'], message: 'Alguna especialidad no corresponde a tu profesión' });
    }
    const okApproaches = approachesFor(v.profession);
    if (v.corrientes.some((x) => !okApproaches.includes(x))) {
      ctx.addIssue({ code: 'custom', path: ['corrientes'], message: 'Alguna corriente no corresponde a tu profesión' });
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
  title: { maxBytes: 8 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
} as const;
