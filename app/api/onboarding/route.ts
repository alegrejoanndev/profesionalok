import { and, eq, ne } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import sharp from 'sharp';
import { professionals } from '@/db/schema';
import { createCheckoutForProfessional } from '@/lib/billing';
import { getDb, hasDatabase } from '@/lib/db';
import { matriculaMode, validateMatricula } from '@/lib/matricula';
import { gateResponse, isBlocking } from '@/lib/matricula-gate';
import { makeSlug } from '@/lib/professionals';
import { getProfession } from '@/lib/professions';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { savePhoto, saveTitle } from '@/lib/storage';
import { TERMS_VERSION } from '@/lib/site';
import { applyMatriculaResult } from '@/lib/verification';
import { FILE_LIMITS, normalizeArPhone, onboardingSchema } from '@/lib/validation';

export const runtime = 'nodejs';

const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

/** Detecta el tipo REAL del archivo mirando su contenido, no la extensión ni el tipo que declara el navegador. */
async function sniff(buf: Buffer): Promise<'pdf' | 'jpg' | 'png' | 'webp' | null> {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  try {
    const meta = await sharp(buf).metadata();
    if (meta.format === 'jpeg') return 'jpg';
    if (meta.format === 'png') return 'png';
    if (meta.format === 'webp') return 'webp';
  } catch {
    /* no es una imagen válida */
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!hasDatabase()) return fail('El registro todavía no está habilitado: falta configurar la base de datos.', 503);
  if (!rateLimit(`onboarding:${clientIp(req.headers)}`, 8, 60 * 60 * 1000)) {
    return fail('Hiciste muchos intentos. Probá de nuevo en una hora.', 429);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return fail('No pudimos leer el formulario. Probá de nuevo.');

  // 1) Datos
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get('data') ?? '{}'));
  } catch {
    return fail('Los datos del formulario no son válidos.');
  }
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join('.')] ??= i.message;
    return fail('Revisá los datos marcados.', 400, { fieldErrors });
  }
  const v = parsed.data;
  // Con la validación automática activa, el DNI o CUIT es obligatorio: es lo que confirma que la matrícula es de quien se registra.
  if (matriculaMode() !== 'off' && !v.dni) {
    return fail('Revisá los datos marcados.', 400, { fieldErrors: { dni: 'Ingresá tu DNI o tu CUIT para verificar tu matrícula' } });
  }

  // 2) Archivos. La foto es OPCIONAL (sin foto, el perfil muestra el logo); el título es obligatorio.
  const photo = form.get('photo');
  const title = form.get('title');
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (!(title instanceof File) || title.size === 0) return fail('Falta la foto o el PDF de tu título.');
  if (hasPhoto && photo.size > FILE_LIMITS.photo.maxBytes) return fail('La foto pesa más de 8 MB.');
  if (title.size > FILE_LIMITS.title.maxBytes) return fail('El archivo del título pesa más de 8 MB.');

  const photoBuf = hasPhoto ? Buffer.from(await photo.arrayBuffer()) : null;
  const titleBuf = Buffer.from(await title.arrayBuffer());
  const photoKind = photoBuf ? await sniff(photoBuf) : null;
  const titleKind = await sniff(titleBuf);
  if (photoBuf && (!photoKind || photoKind === 'pdf')) return fail('La foto de perfil tiene que ser una imagen JPG, PNG o WebP.');
  if (!titleKind) return fail('El título tiene que ser una imagen (JPG, PNG, WebP) o un PDF.');

  // 3) Matrícula principal y adicionales
  const prof = getProfession(v.profession)!;
  const primary = prof.licenses.find((l) => l.required) ?? prof.licenses[0];
  const licenseNumber = (v.licenses[primary.type] ?? '').trim();
  const extraLicenses = Object.fromEntries(
    prof.licenses
      .filter((l) => l.type !== primary.type && (v.licenses[l.type] ?? '').trim())
      .map((l) => [l.type, v.licenses[l.type].trim()]),
  );

  const db = getDb();

  // 4) Duplicados. Si el email ya empezó el alta y nunca pagó, se retoma (así no queda bloqueado si abandonó el pago).
  const [byEmail] = await db.select().from(professionals).where(eq(professionals.email, v.email)).limit(1);
  if (byEmail && byEmail.status !== 'PENDING_PAYMENT') {
    return fail(
      'Ya hay un perfil registrado con ese email. Si querés regularizar tu suscripción, usá el enlace que te enviamos por mail, o escribinos desde Contacto.',
      409,
    );
  }
  const [byLicense] = await db
    .select({ id: professionals.id })
    .from(professionals)
    .where(
      and(
        eq(professionals.profession, v.profession),
        eq(professionals.licenseType, primary.type),
        eq(professionals.licenseProvince, v.licenseProvince),
        eq(professionals.licenseNumber, licenseNumber),
        byEmail ? ne(professionals.id, byEmail.id) : undefined,
      ),
    )
    .limit(1);
  if (byLicense) {
    return fail('Esa matrícula ya está registrada. Si es tuya y creés que es un error, escribinos desde Contacto.', 409);
  }

  // 5) Verificación de la matrícula contra el padrón oficial ANTES de guardar nada y de cobrar.
  //    Si no figura, no coincide o no está habilitada, no se crea el perfil ni el checkout (la persona puede corregir o darse de baja).
  //    Si el padrón no responde (o la validación automática está apagada), se sigue: lo revisa una persona antes de publicar.
  //    El DNI/CUIT se usa solo para esta consulta; no se guarda ni se registra.
  const matricula = await validateMatricula({
    firstName: v.firstName,
    lastName: v.lastName,
    profession: v.profession,
    licenseNumber,
    licenseProvince: v.licenseProvince,
    dni: v.dni || undefined,
  });
  if (isBlocking(matricula.status)) {
    const g = gateResponse(matricula);
    return fail(g.message, 422, { matricula: g });
  }

  // 6) Guardar archivos y perfil
  const id = byEmail?.id ?? crypto.randomUUID();
  let photoUrl: string | null = null;
  let titleDocPath: string;
  try {
    if (photoBuf) photoUrl = await savePhoto(id, photoBuf);
    titleDocPath = await saveTitle(id, titleBuf, titleKind);
  } catch (err) {
    console.error('[onboarding] no se pudieron guardar los archivos', err);
    return fail('No pudimos procesar tus archivos. Probá con otra foto o con un archivo más liviano.', 422);
  }

  const values = {
    firstName: v.firstName,
    lastName: v.lastName,
    phone: normalizeArPhone(v.phone)!,
    profession: v.profession,
    licenseType: primary.type,
    licenseNumber,
    licenseProvince: v.licenseProvince,
    extraLicenses: Object.keys(extraLicenses).length ? extraLicenses : null,
    city: v.city,
    province: v.province,
    bio: v.bio || null,
    specialties: v.specialties,
    corrientes: v.corrientes,
    ageGroups: v.ageGroups,
    modalidad: v.modalidad,
    obrasSociales: [...new Set(v.obrasSociales)],
    photoUrl: photoUrl ?? byEmail?.photoUrl ?? null, // sin foto nueva se conserva la anterior (si había)
    titleDocPath,
    verificationStatus: 'PENDING' as const,
    termsAcceptedAt: new Date(),
    termsVersion: TERMS_VERSION,
  };

  try {
    if (byEmail) {
      await db.update(professionals).set(values).where(eq(professionals.id, id));
    } else {
      await db.insert(professionals).values({
        id,
        slug: makeSlug(v.firstName, v.lastName, licenseNumber),
        email: v.email,
        ...values,
      });
    }
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return fail('Ese email o esa matrícula ya están registrados. Escribinos desde Contacto si creés que es un error.', 409);
    }
    console.error('[onboarding] error al guardar', err);
    return fail('No pudimos guardar tus datos. Probá de nuevo en unos minutos.', 500);
  }

  // 7) Se registra el resultado de la verificación (si coincide por DNI/CUIT, el perfil se aprueba solo)
  await applyMatriculaResult(id, matricula, 'onboarding').catch((err) => console.error('[onboarding] no se pudo guardar la validación', err));

  // 8) Checkout de Mercado Pago
  try {
    const initPoint = await createCheckoutForProfessional({ id, email: v.email });
    return NextResponse.json({ initPoint, matricula: matricula.status });
  } catch (err) {
    console.error('[onboarding] no se pudo crear el checkout', err);
    return fail(
      'Guardamos tus datos pero no pudimos iniciar el pago. Volvé a enviar el formulario con el mismo email y lo retomamos.',
      502,
    );
  }
}
