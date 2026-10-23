import { SITE } from './site';

/** En pruebas automáticas se apunta a un Mercado Pago falso con MP_API_URL. */
const api = () => process.env.MP_API_URL ?? 'https://api.mercadopago.com';

/**
 * Modo simulador: no llama a Mercado Pago, redirige a /dev/mp-simulador para probar todo el flujo
 * sin cuenta. Es explícito (MP_MODE=mock) y está bloqueado en producción salvo ALLOW_MP_MOCK=1,
 * porque el simulador permite "aprobar" pagos sin pagar.
 */
export const isMockMode = () =>
  process.env.MP_MODE === 'mock' && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_MP_MOCK === '1');

/** Meses de prueba gratis que se ofrecen (TRIAL_MONTHS, por defecto 1; 0 = sin prueba). */
export const trialMonths = () => {
  const n = Math.floor(Number(process.env.TRIAL_MONTHS ?? '1'));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 12) : 1;
};

/**
 * Modo enlace: en vez de crear un checkout por profesional con la API, se manda al profesional al
 * link de suscripción de Mercado Pago (SITE.paymentLink, o MP_SUBSCRIPTION_LINK para cambiarlo; vacío = modo API). Después, el
 * pago se asocia al profesional por el email (ver lib/billing.ts). Es la opción menos precisa:
 * el modo API (sin link) asocia cada pago al profesional sin ambigüedad.
 */
export const subscriptionLink = () => process.env.MP_SUBSCRIPTION_LINK ?? SITE.paymentLink;

export const isLinkMode = () => !isMockMode() && !!subscriptionLink();

/** Suscripción ("preapproval"). Solo los campos que usamos. */
export type Preapproval = {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  external_reference?: string;
  payer_email?: string;
  next_payment_date?: string;
  init_point?: string;
};

/** Cobro recurrente de una suscripción ("authorized payment"). */
export type AuthorizedPayment = {
  id: number | string;
  preapproval_id: string;
  /** scheduled | processed | recycling | cancelled */
  status: string;
  retry_attempt?: number;
  debit_date?: string;
  payment?: { id?: number; status?: string; status_detail?: string };
};

async function mp<T>(path: string, method: 'GET' | 'POST' | 'PUT' = 'GET', json?: unknown): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('Falta MP_ACCESS_TOKEN (o usá MP_MODE=mock para probar con el simulador)');

  const res = await fetch(`${api()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: json ? JSON.stringify(json) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Mercado Pago ${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const getPreapproval = (id: string) => mp<Preapproval>(`/preapproval/${id}`);

export const getAuthorizedPayment = (id: string) => mp<AuthorizedPayment>(`/authorized_payments/${id}`);

export async function cancelPreapproval(id: string) {
  if (id.startsWith('mock_')) return;
  return mp<Preapproval>(`/preapproval/${id}`, 'PUT', { status: 'cancelled' });
}

/**
 * Paso 3 del onboarding (y página /regularizar): crea una suscripción mensual sin plan y
 * con pago pendiente. La respuesta trae `init_point`: la URL de Mercado Pago a la que
 * redirigís al profesional para cargar su tarjeta.
 */
export async function createSubscriptionCheckout(input: {
  professionalId: string;
  payerEmail: string;
  /** Si es true, se agrega el mes gratis (free_trial): el primer cobro ocurre cuando termina. */
  withTrial?: boolean;
}): Promise<Preapproval> {
  if (isMockMode()) {
    const id = `mock_${crypto.randomUUID()}`;
    return { id, status: 'pending', init_point: `${SITE.url}/dev/mp-simulador?pre=${id}` };
  }

  const amount = Number(process.env.MEMBERSHIP_PRICE_ARS);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('MEMBERSHIP_PRICE_ARS inválido');

  return mp<Preapproval>('/preapproval', 'POST', {
    reason: `Suscripción mensual — ${SITE.name}`,
    external_reference: input.professionalId,
    payer_email: input.payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: amount,
      currency_id: 'ARS',
      ...(input.withTrial && trialMonths() > 0
        ? { free_trial: { frequency: trialMonths(), frequency_type: 'months' } }
        : {}),
    },
    back_url: `${SITE.url}/asociar/gracias`,
    status: 'pending',
  });
}
