import { NextResponse, type NextRequest } from 'next/server';
import { gateResponse } from '@/lib/matricula-gate';
import { matriculaMode, validateMatricula } from '@/lib/matricula';
import { getProfession } from '@/lib/professions';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { onboardingSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * Paso previo al pago: consulta la matrícula en el padrón oficial (REFEPS) apenas la persona completa sus datos,
 * antes de pedirle documentación o dinero. No guarda nada. Devuelve solo el estado y un mensaje genérico
 * (nunca datos del padrón), con límite de intentos para que no sirva para averiguar datos de terceros.
 * El alta (/api/onboarding) vuelve a verificar en el servidor: este endpoint es solo para avisar antes.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`matricula:${clientIp(req.headers)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Hiciste muchas verificaciones. Probá de nuevo en una hora.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  // Se valida con el mismo esquema del alta (acceptTerms no se pide acá)
  const parsed = onboardingSchema.safeParse({ ...(body ?? {}), acceptTerms: true });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join('.')] ??= i.message;
    return NextResponse.json({ error: 'Revisá los datos marcados.', fieldErrors }, { status: 400 });
  }
  const v = parsed.data;

  const mode = matriculaMode();
  if (mode !== 'off' && !v.dni) {
    return NextResponse.json({ error: 'Revisá los datos marcados.', fieldErrors: { dni: 'Ingresá tu DNI o tu CUIT para verificar tu matrícula' } }, { status: 400 });
  }

  const prof = getProfession(v.profession)!;
  const primary = prof.licenses.find((l) => l.required) ?? prof.licenses[0];
  const result = await validateMatricula({
    firstName: v.firstName,
    lastName: v.lastName,
    profession: v.profession,
    licenseNumber: (v.licenses[primary.type] ?? '').trim(),
    licenseProvince: v.licenseProvince,
    dni: v.dni || undefined,
  });
  return NextResponse.json({ ...gateResponse(result), mode });
}
