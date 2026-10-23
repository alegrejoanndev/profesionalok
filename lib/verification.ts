import { and, eq, isNull } from 'drizzle-orm';
import { professionals, subscriptions } from '@/db/schema';
import { refreshPublicPages } from './cache';
import { getDb } from './db';
import { validateMatricula, type MatriculaInput, type MatriculaResult } from './matricula';

/**
 * Aplica el resultado de la validación de matrícula a un perfil.
 *
 * Reglas (la validación automática SOLO puede aprobar, nunca rechazar):
 *  - VERIFIED y el título está pendiente  → se aprueba solo (verificationMethod = AUTO_REFEPS) si la
 *    identidad se confirmó por DNI (política "dni", por defecto), salvo que una persona lo haya
 *    rechazado antes. MATRICULA_AUTO_APPROVE: "dni" | "always" (también por nombre + matrícula) | "never".
 *  - NOT_ENABLED en un perfil ya aprobado (revalidación) → se oculta (LICENSE_INVALID) y vuelve a
 *    revisión manual. El sistema de cobros no lo reactiva.
 *  - VERIFIED en un perfil suspendido por LICENSE_INVALID → se reactiva.
 *  - Cualquier otro resultado solo queda registrado para que una persona lo revise en /admin.
 *  - UNAVAILABLE en una revalidación no pisa un resultado anterior (un corte de SISA no debe cambiar nada).
 */
export type ApplyContext = 'onboarding' | 'recheck' | 'cron';

export async function applyMatriculaResult(professionalId: string, result: MatriculaResult, context: ApplyContext) {
  const db = getDb();
  const [prof] = await db.select().from(professionals).where(eq(professionals.id, professionalId)).limit(1);
  if (!prof) return 'not_found' as const;

  if (context !== 'onboarding' && (result.status === 'UNAVAILABLE' || result.status === 'NOT_CHECKED')) {
    return 'skipped' as const;
  }

  const now = new Date();
  const base = {
    matriculaStatus: result.status,
    matriculaCheckedAt: now,
    matriculaDetail: result.detail,
    matriculaSource: result.source === 'NONE' ? null : result.source,
    ...(result.refepsCode ? { refepsCode: result.refepsCode } : {}),
  };

  const policy = (process.env.MATRICULA_AUTO_APPROVE ?? 'dni').toLowerCase();
  const strongIdentity = result.method === 'dni' || result.method === 'code' || result.method === 'mock';
  const autoApprove = policy === 'always' || (policy === 'dni' && strongIdentity);
  let outcome: 'recorded' | 'auto_approved' | 'suspended' | 'reactivated' = 'recorded';
  let extra: Partial<typeof professionals.$inferInsert> = {};

  if (result.status === 'VERIFIED') {
    if (prof.verificationStatus === 'PENDING' && autoApprove) {
      extra = { verificationStatus: 'APPROVED', verifiedAt: now, verificationMethod: 'AUTO_REFEPS', rejectionNote: null };
      outcome = 'auto_approved';
    }
    if (prof.inactiveReason === 'LICENSE_INVALID') {
      const [sub] = await db.select({ s: subscriptions.status }).from(subscriptions).where(eq(subscriptions.professionalId, prof.id));
      extra = {
        ...extra,
        verificationStatus: 'APPROVED',
        verifiedAt: now,
        verificationMethod: 'AUTO_REFEPS',
        status: sub?.s === 'AUTHORIZED' ? 'ACTIVE' : 'PENDING_PAYMENT',
        inactiveReason: null,
      };
      outcome = 'reactivated';
    }
  } else if (result.status === 'NOT_ENABLED' && context !== 'onboarding' && prof.verificationStatus === 'APPROVED') {
    extra = {
      verificationStatus: 'PENDING',
      verifiedAt: null,
      status: 'INACTIVE',
      inactiveReason: 'LICENSE_INVALID',
    };
    outcome = 'suspended';
  }

  await db
    .update(professionals)
    .set({ ...base, ...extra })
    .where(and(eq(professionals.id, prof.id), isNull(professionals.deletedAt)));

  if (outcome !== 'recorded') refreshPublicPages();
  return outcome;
}

/** Vuelve a consultar el registro con los datos guardados (sin DNI: usa el código federal o apellido + matrícula). */
export async function revalidateProfessional(professionalId: string, context: ApplyContext = 'recheck') {
  const [p] = await getDb().select().from(professionals).where(eq(professionals.id, professionalId)).limit(1);
  if (!p) return { outcome: 'not_found' as const };

  const input: MatriculaInput = {
    firstName: p.firstName,
    lastName: p.lastName,
    profession: p.profession,
    licenseNumber: p.licenseNumber,
    licenseProvince: p.licenseProvince,
    refepsCode: p.refepsCode,
  };
  const result = await validateMatricula(input);
  const outcome = await applyMatriculaResult(p.id, result, context);
  return { outcome, result };
}
