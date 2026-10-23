import crypto from 'node:crypto';
import { and, eq, inArray, isNull, like, lt, notInArray, or, sql } from 'drizzle-orm';
import { professionals, subscriptions } from '@/db/schema';
import { refreshPublicPages } from './cache';
import { getDb } from './db';
import { sendPaymentFailedEmail, sendSubscriptionCancelledEmail } from './email';
import {
  cancelPreapproval,
  createSubscriptionCheckout,
  getPreapproval,
  isLinkMode,
  subscriptionLink,
  trialMonths,
  type AuthorizedPayment,
  type Preapproval,
} from './mercadopago';

/**
 * Reglas de negocio de cobros. Todas las funciones son IDEMPOTENTES: Mercado Pago puede
 * enviar la misma notificación más de una vez, y los mails solo salen cuando el estado
 * realmente cambia (UPDATE ... RETURNING devuelve cuántas filas cambiaron).
 *
 * Política (ajustable acá):
 *  - Mes gratis                → se concede UNA vez por profesional. El perfil se activa cuando la
 *                                suscripción queda AUTORIZADA (el primer cobro ocurre al terminar la prueba).
 *  - Sin prueba (ya la usó, o  → el perfil se activa recién cuando se aprueba el primer cobro.
 *    regulariza un pago)
 *  - Cobro rechazado           → baja lógica inmediata (perfil oculto) + mail con link para regularizar.
 *  - Mercado Pago reintenta    → hasta 4 veces en ~10 días. Si un reintento sale bien, se reactiva solo.
 *  - Último reintento fallido  → se cancela la suscripción en Mercado Pago y se avisa por mail.
 *  - Cancelar durante la prueba→ baja del perfil (CANCELLED_BY_USER) y no se cobra nada.
 */

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};

/** Condición para activar un perfil: nunca reactiva suspensiones manuales ni por matrícula inválida. */
const activationWhere = (professionalId: string) =>
  and(
    eq(professionals.id, professionalId),
    isNull(professionals.deletedAt),
    inArray(professionals.status, ['PENDING_PAYMENT', 'INACTIVE']),
    // (Se usa OR porque en SQL "NOT IN (...)" descarta los NULL.)
    or(isNull(professionals.inactiveReason), notInArray(professionals.inactiveReason, ['ADMIN', 'LICENSE_INVALID'])),
  );
const ACTIVATE = { status: 'ACTIVE' as const, inactiveReason: null, regularizeToken: null, regularizeTokenExpiresAt: null };

const lookupSubscription = async (preapprovalId: string) => {
  const [row] = await getDb()
    .select({ sub: subscriptions, professional: professionals })
    .from(subscriptions)
    .innerJoin(professionals, eq(subscriptions.professionalId, professionals.id))
    .where(eq(subscriptions.mpPreapprovalId, preapprovalId))
    .limit(1);
  return row ? { ...row.sub, professional: row.professional } : null;
};

/**
 * Busca la suscripción por su id de Mercado Pago. En modo enlace, si el id es nuevo, intenta
 * vincularlo con un profesional por el email del pagador.
 */
async function findSubscription(preapprovalId: string) {
  const found = await lookupSubscription(preapprovalId);
  if (found || !isLinkMode() || preapprovalId.startsWith('link_')) return found;

  let pre: Preapproval;
  try {
    pre = await getPreapproval(preapprovalId);
  } catch {
    return null;
  }
  const email = pre.payer_email?.trim().toLowerCase();
  if (!email) return null;

  const [pending] = await getDb()
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .innerJoin(professionals, eq(subscriptions.professionalId, professionals.id))
    .where(and(like(subscriptions.mpPreapprovalId, 'link_%'), sql`lower(${professionals.email}) = ${email}`))
    .limit(1);
  if (!pending) return null; // sin coincidencia: queda para vincular a mano en /admin

  await getDb().update(subscriptions).set({ mpPreapprovalId: preapprovalId }).where(eq(subscriptions.id, pending.id));
  return lookupSubscription(preapprovalId);
}

/** Vincula a mano una suscripción de Mercado Pago con un profesional (panel /admin, modo enlace). */
export async function linkSubscriptionManually(preapprovalId: string, professionalId: string) {
  const db = getDb();
  const [target] = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.professionalId, professionalId));
  if (!target) throw new Error('El profesional no tiene un checkout pendiente');
  const [taken] = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.mpPreapprovalId, preapprovalId));
  if (taken) throw new Error('Esa suscripción ya está vinculada');
  await db.update(subscriptions).set({ mpPreapprovalId: preapprovalId }).where(eq(subscriptions.id, target.id));
  return handlePreapprovalStatus(await getPreapproval(preapprovalId));
}

/** Los errores de mail no deben hacer fallar el webhook (Mercado Pago reintentaría y duplicaría cambios). */
async function safely(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error(`[billing] ${label} falló:`, err);
    // TODO producción: guardar en una tabla "outbox" para reintentar el envío.
  }
}

// ───────────────────────── Checkout (alta y regularización) ─────────────────────────

/**
 * Crea un checkout de suscripción para el profesional y lo guarda. Sirve para el alta (paso 3)
 * y para regularizar: si ya había una suscripción, la reemplaza y cancela la anterior en Mercado Pago.
 * Devuelve la URL a la que hay que redirigir al profesional.
 *
 * El mes gratis se ofrece solo si TRIAL_MONTHS > 0 y el profesional nunca tuvo una prueba
 * (así no se puede repetir cancelando y volviendo a suscribirse).
 */
export async function createCheckoutForProfessional(prof: { id: string; email: string }) {
  const db = getDb();
  const [row] = await db.select({ trialUsedAt: professionals.trialUsedAt }).from(professionals).where(eq(professionals.id, prof.id));
  const withTrial = trialMonths() > 0 && !row?.trialUsedAt;
  const amount = String(Number(process.env.MEMBERSHIP_PRICE_ARS ?? '0'));

  let preapprovalId: string;
  let initPoint: string | undefined;
  let hasTrial = withTrial;
  if (isLinkMode()) {
    // La prueba y el precio los define el plan del link, creado en tu panel de Mercado Pago.
    preapprovalId = `link_${prof.id}`;
    initPoint = subscriptionLink();
    hasTrial = withTrial && process.env.MP_LINK_HAS_TRIAL !== 'false';
  } else {
    const pre = await createSubscriptionCheckout({ professionalId: prof.id, payerEmail: prof.email, withTrial });
    preapprovalId = pre.id;
    initPoint = pre.init_point;
  }
  if (!initPoint) throw new Error('Mercado Pago no devolvió init_point');

  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.professionalId, prof.id)).limit(1);
  if (existing) {
    await db
      .update(subscriptions)
      .set({
        mpPreapprovalId: preapprovalId,
        status: 'PENDING',
        amount,
        hasTrial,
        trialEndsAt: null,
        checkoutUrl: initPoint,
        failedAttempts: 0,
        cancelledAt: null,
        cancelReason: null,
      })
      .where(eq(subscriptions.id, existing.id));
    // La anterior se cancela DESPUÉS de reemplazar el id: sus avisos ya no coinciden con ninguna fila y se ignoran.
    if (existing.status !== 'CANCELLED' && !existing.mpPreapprovalId.startsWith('link_')) {
      await safely('cancelPreapproval(anterior)', () => cancelPreapproval(existing.mpPreapprovalId));
    }
  } else {
    await db.insert(subscriptions).values({
      professionalId: prof.id,
      mpPreapprovalId: preapprovalId,
      amount,
      hasTrial,
      checkoutUrl: initPoint,
    });
  }
  return initPoint;
}

// ───────────────────────── Cobro recurrente (subscription_authorized_payment) ─────────────────────────

export async function handleAuthorizedPayment(ap: AuthorizedPayment) {
  const paymentStatus = ap.payment?.status;

  if (paymentStatus === 'approved') return markPaymentApproved(ap.preapproval_id);

  const rejected = paymentStatus === 'rejected' || ap.status === 'recycling';
  if (rejected) {
    // "processed" + pago rechazado = se agotaron los reintentos de Mercado Pago.
    const final = ap.status === 'processed';
    return markPaymentFailed(ap.preapproval_id, { final, attempt: ap.retry_attempt });
  }

  return 'ignored'; // scheduled, in_process, cancelled…
}

/** Pago aprobado → perfil activo (y reactivación automática si estaba dado de baja por falta de pago). */
export async function markPaymentApproved(preapprovalId: string) {
  const sub = await findSubscription(preapprovalId);
  if (!sub) return 'unknown_subscription';

  await getDb().transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status: 'AUTHORIZED', failedAttempts: 0, lastPaymentAt: new Date(), cancelledAt: null, cancelReason: null })
      .where(eq(subscriptions.id, sub.id));
    await tx.update(professionals).set(ACTIVATE).where(activationWhere(sub.professionalId));
  });

  refreshPublicPages();
  return 'payment_approved';
}

/** Pago rechazado → baja lógica del perfil + mail. Si `final`, además cancela la suscripción. */
export async function markPaymentFailed(preapprovalId: string, opts: { final: boolean; attempt?: number }) {
  const sub = await findSubscription(preapprovalId);
  if (!sub) return 'unknown_subscription';

  const now = new Date();
  const newToken = crypto.randomBytes(32).toString('hex');

  const { hidden, prof } = await getDb().transaction(async (tx) => {
    // 1) Baja lógica: solo cuenta si realmente pasó de ACTIVE a INACTIVE
    const hiddenRows = await tx
      .update(professionals)
      .set({ status: 'INACTIVE', inactiveReason: 'PAYMENT_FAILED' })
      .where(and(eq(professionals.id, sub.professionalId), eq(professionals.status, 'ACTIVE')))
      .returning({ id: professionals.id });

    // 2) Token para el link de regularización: solo si no hay uno vigente
    //    (así un webhook duplicado no invalida el link que ya se envió por mail)
    await tx
      .update(professionals)
      .set({ regularizeToken: newToken, regularizeTokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS) })
      .where(
        and(
          eq(professionals.id, sub.professionalId),
          or(isNull(professionals.regularizeToken), lt(professionals.regularizeTokenExpiresAt, now)),
        ),
      );

    // 3) Estado de la suscripción en nuestra base
    await tx
      .update(subscriptions)
      .set({
        status: opts.final ? 'CANCELLED' : 'PAST_DUE',
        lastFailureAt: now,
        ...(opts.attempt != null ? { failedAttempts: opts.attempt } : {}),
        ...(opts.final ? { cancelledAt: now, cancelReason: 'PAYMENT_FAILED' } : {}),
      })
      .where(eq(subscriptions.id, sub.id));

    const [p] = await tx
      .select({ email: professionals.email, firstName: professionals.firstName, token: professionals.regularizeToken })
      .from(professionals)
      .where(eq(professionals.id, sub.professionalId));
    return { hidden: hiddenRows.length, prof: p };
  });

  refreshPublicPages();

  // Último reintento fallido: cancelar en Mercado Pago para que no siga intentando cobrar
  if (opts.final && sub.status !== 'CANCELLED') {
    await safely('cancelPreapproval', () => cancelPreapproval(preapprovalId));
  }

  const mail = { to: prof.email, firstName: prof.firstName, token: prof.token! };

  // Mails: uno por cada transición real, nunca por notificaciones repetidas
  if (hidden === 1) {
    await safely('sendPaymentFailedEmail', () => sendPaymentFailedEmail(mail));
    return 'suspended_and_notified';
  }
  if (opts.final && sub.status !== 'CANCELLED') {
    await safely('sendSubscriptionCancelledEmail', () => sendSubscriptionCancelledEmail(mail));
    return 'cancelled_and_notified';
  }
  return 'already_suspended';
}

// ───────────────────────── Estado de la suscripción (subscription_preapproval) ─────────────────────────

export async function handlePreapprovalStatus(pre: Preapproval) {
  const sub = await findSubscription(pre.id);
  if (!sub) return 'unknown_subscription';
  const db = getDb();

  switch (pre.status) {
    case 'authorized': {
      const nextPayment = pre.next_payment_date ? new Date(pre.next_payment_date) : undefined;
      // Primera autorización de una suscripción con mes gratis → empieza la prueba.
      const startsTrial = sub.hasTrial && sub.status === 'PENDING';
      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({
            ...(sub.status === 'PENDING' ? { status: 'AUTHORIZED' as const } : {}),
            ...(nextPayment ? { nextPaymentDate: nextPayment } : {}),
            // La prueba termina cuando Mercado Pago programa el primer cobro (o, si no lo informa, en N meses)
            ...(startsTrial ? { trialEndsAt: nextPayment ?? addMonths(now, trialMonths() || 1) } : {}),
          })
          .where(eq(subscriptions.id, sub.id));

        if (startsTrial) {
          // Durante la prueba no hay cobro que esperar: el perfil se activa ahora.
          await tx.update(professionals).set({ trialUsedAt: now }).where(and(eq(professionals.id, sub.professionalId), isNull(professionals.trialUsedAt)));
          await tx.update(professionals).set(ACTIVATE).where(activationWhere(sub.professionalId));
        }
      });

      if (startsTrial) refreshPublicPages();
      return startsTrial ? 'trial_started' : 'authorized';
    }

    case 'paused':
    case 'cancelled': {
      if (sub.status === 'CANCELLED' || (pre.status === 'paused' && sub.status === 'PAUSED')) return 'noop';

      // Cancelada o pausada desde Mercado Pago (la cancelación por falta de pago ya quedó CANCELLED arriba)
      await db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set(
            pre.status === 'cancelled'
              ? { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'CANCELLED_BY_USER' }
              : { status: 'PAUSED' },
          )
          .where(eq(subscriptions.id, sub.id));
        await tx
          .update(professionals)
          .set({ status: 'INACTIVE', inactiveReason: 'CANCELLED_BY_USER' })
          .where(and(eq(professionals.id, sub.professionalId), eq(professionals.status, 'ACTIVE')));
      });
      refreshPublicPages();
      return pre.status === 'cancelled' ? 'cancelled_by_user' : 'paused';
    }

    default:
      return 'ignored'; // pending
  }
}
