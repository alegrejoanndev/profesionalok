import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { webhookLogs } from '@/db/schema';
import { getDb } from '@/lib/db';
import { handleAuthorizedPayment, handlePreapprovalStatus } from '@/lib/billing';
import { getAuthorizedPayment, getPreapproval } from '@/lib/mercadopago';

export const runtime = 'nodejs'; // usamos node:crypto y node-postgres
export const dynamic = 'force-dynamic';

/**
 * Webhook de Mercado Pago.
 * URL a cargar en Tus integraciones → Webhooks (modo producción):
 *   https://profesionalesok.com.ar/api/webhooks/mercadopago
 * Eventos a activar: "Planes y suscripciones" (subscription_preapproval y
 * subscription_authorized_payment) y "Pagos" (payment).
 *
 * Flujo:
 *  1. Verifica la firma HMAC (x-signature). Si no coincide → 401, sin tocar la base.
 *  2. NO confía en el cuerpo de la notificación: consulta el estado real a la API de Mercado Pago.
 *  3. Aplica la regla de negocio (lib/billing.ts) de forma idempotente.
 *  4. Responde 200 si procesó; 500 si falló, para que Mercado Pago reintente.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  let body: { type?: string; data?: { id?: string | number } } = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    /* algunas notificaciones llegan solo con query params */
  }

  const url = req.nextUrl;
  const dataId = url.searchParams.get('data.id') ?? (body.data?.id != null ? String(body.data.id) : null);
  const topic = url.searchParams.get('type') ?? body.type ?? url.searchParams.get('topic') ?? 'unknown';

  // 1) Autenticidad
  if (!isValidSignature(req, dataId)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  if (!dataId) return NextResponse.json({ received: true, ignored: 'no data.id' });

  // Auditoría
  const db = getDb();
  const [log] = await db
    .insert(webhookLogs)
    .values({ topic, resourceId: dataId, requestId: req.headers.get('x-request-id'), payload: body })
    .returning({ id: webhookLogs.id });

  try {
    // 2) y 3) Consultar el estado real y aplicar la regla
    let outcome: string;
    switch (topic) {
      case 'subscription_authorized_payment': {
        // Cada cobro mensual: aprobado → activa/reactiva; rechazado → baja lógica + mail
        outcome = await handleAuthorizedPayment(await getAuthorizedPayment(dataId));
        break;
      }
      case 'subscription_preapproval': {
        // Cambios de estado de la suscripción (autorizada, pausada, cancelada)
        outcome = await handlePreapprovalStatus(await getPreapproval(dataId));
        break;
      }
      default:
        outcome = 'ignored_topic'; // "payment" y otros: el estado ya llega por authorized_payment
    }

    await db.update(webhookLogs).set({ outcome }).where(eq(webhookLogs.id, log.id));
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[mp-webhook]', topic, dataId, message);
    await db.update(webhookLogs).set({ error: message }).where(eq(webhookLogs.id, log.id)).catch(() => {});
    // 4) Un 5xx hace que Mercado Pago reintente más tarde
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}

/**
 * Valida el header x-signature según la documentación de Mercado Pago:
 *   x-signature: ts=<timestamp>,v1=<hmac>
 *   manifest   : id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *   v1         : HMAC-SHA256(manifest, MP_WEBHOOK_SECRET) en hexadecimal
 * El data.id se usa en minúsculas si es alfanumérico.
 */
function isValidSignature(req: NextRequest, dataId: string | null): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return false; // sin secreto, se rechaza todo (falla cerrado)

  const header = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id');
  if (!header || !requestId || !dataId) return false;

  const parts: Record<string, string> = {};
  for (const piece of header.split(',')) {
    const i = piece.indexOf('=');
    if (i > 0) parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
  }
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
