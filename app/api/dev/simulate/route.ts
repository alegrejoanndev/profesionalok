import { NextResponse, type NextRequest } from 'next/server';
import { handleAuthorizedPayment, handlePreapprovalStatus } from '@/lib/billing';
import { isMockMode, trialMonths } from '@/lib/mercadopago';

export const runtime = 'nodejs';

/**
 * SOLO MODO SIMULADOR (MP_MODE=mock). Dispara las mismas funciones que usa el webhook real,
 * para poder probar aprobación, rechazo y cancelación sin una cuenta de Mercado Pago.
 */
export async function POST(req: NextRequest) {
  if (!isMockMode()) return new NextResponse('No encontrado', { status: 404 });

  const { pre, action } = (await req.json().catch(() => ({}))) as { pre?: string; action?: string };
  if (!pre || !pre.startsWith('mock_')) return NextResponse.json({ error: 'Falta la suscripción simulada.' }, { status: 400 });

  const payment = (status: string, apStatus: string, attempt?: number) =>
    handleAuthorizedPayment({ id: `sim-${Date.now()}`, preapproval_id: pre, status: apStatus, retry_attempt: attempt, payment: { status } });

  const results: string[] = [];
  switch (action) {
    case 'authorize': {
      // El profesional cargó su tarjeta: empieza el mes gratis (el primer cobro queda programado para después)
      const next = new Date();
      next.setMonth(next.getMonth() + (trialMonths() || 1));
      results.push(await handlePreapprovalStatus({ id: pre, status: 'authorized', next_payment_date: next.toISOString() }));
      break;
    }
    case 'approve':
      results.push(await payment('approved', 'processed'));
      break;
    case 'reject':
      results.push(await payment('rejected', 'recycling', 1));
      break;
    case 'reject_final':
      results.push(await payment('rejected', 'processed', 4));
      break;
    case 'cancel':
      results.push(await handlePreapprovalStatus({ id: pre, status: 'cancelled' }));
      break;
    default:
      return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, results });
}
