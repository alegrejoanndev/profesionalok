'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { professionals, subscriptions } from '@/db/schema';
import { linkSubscriptionManually } from '@/lib/billing';
import { getDb } from '@/lib/db';
import { revalidateProfessional } from '@/lib/verification';

const refresh = () => {
  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/profesionales');
};
const idOf = (fd: FormData) => String(fd.get('id') ?? '');

export async function approve(fd: FormData) {
  await getDb()
    .update(professionals)
    .set({ verificationStatus: 'APPROVED', verifiedAt: new Date(), rejectionNote: null })
    .where(eq(professionals.id, idOf(fd)));
  refresh();
}

export async function reject(fd: FormData) {
  const note = String(fd.get('note') ?? '').trim().slice(0, 300) || null;
  await getDb()
    .update(professionals)
    .set({ verificationStatus: 'REJECTED', verifiedAt: null, rejectionNote: note })
    .where(eq(professionals.id, idOf(fd)));
  refresh();
}

export async function toggleFeatured(fd: FormData) {
  const db = getDb();
  const [p] = await db.select({ f: professionals.isFeatured }).from(professionals).where(eq(professionals.id, idOf(fd)));
  if (p) await db.update(professionals).set({ isFeatured: !p.f }).where(eq(professionals.id, idOf(fd)));
  refresh();
}

/** Suspensión manual: el sistema de cobros no la revierte. */
export async function suspend(fd: FormData) {
  await getDb()
    .update(professionals)
    .set({ status: 'INACTIVE', inactiveReason: 'ADMIN' })
    .where(eq(professionals.id, idOf(fd)));
  refresh();
}

/** Levanta la suspensión manual: queda activo solo si la suscripción está al día. */
export async function restore(fd: FormData) {
  const db = getDb();
  const id = idOf(fd);
  const [sub] = await db.select({ s: subscriptions.status }).from(subscriptions).where(eq(subscriptions.professionalId, id));
  await db
    .update(professionals)
    .set({ status: sub?.s === 'AUTHORIZED' ? 'ACTIVE' : 'PENDING_PAYMENT', inactiveReason: null })
    .where(eq(professionals.id, id));
  refresh();
}

/** Borrado lógico: el perfil desaparece del sitio pero los datos se conservan. */
export async function softDelete(fd: FormData) {
  await getDb().update(professionals).set({ deletedAt: new Date() }).where(eq(professionals.id, idOf(fd)));
  refresh();
}

/** Vuelve a consultar la matrícula en el registro oficial (REFEPS) con los datos guardados. */
export async function recheckMatricula(fd: FormData) {
  await revalidateProfessional(idOf(fd), 'recheck');
  refresh();
}

/** Modo enlace: vincula a mano un pago de Mercado Pago que no se pudo asociar por el email. */
export async function linkSubscription(fd: FormData) {
  const preapprovalId = String(fd.get('preapproval') ?? '').trim();
  const professionalId = String(fd.get('professional') ?? '');
  if (!preapprovalId || !professionalId) return;
  await linkSubscriptionManually(preapprovalId, professionalId);
  refresh();
}
