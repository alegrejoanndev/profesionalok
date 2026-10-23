import { and, eq, gt, isNull } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { professionals } from '@/db/schema';
import { createCheckoutForProfessional } from '@/lib/billing';
import { getDb, hasDatabase } from '@/lib/db';
import { clientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

/** El profesional abre el link del mail y pide un checkout nuevo para volver a suscribirse. */
export async function POST(req: NextRequest) {
  if (!hasDatabase()) return NextResponse.json({ error: 'Servicio no disponible.' }, { status: 503 });
  if (!rateLimit(`regularizar:${clientIp(req.headers)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo más tarde.' }, { status: 429 });
  }

  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: 'El enlace no es válido.' }, { status: 400 });
  }

  const [prof] = await getDb()
    .select({ id: professionals.id, email: professionals.email, status: professionals.status })
    .from(professionals)
    .where(
      and(
        eq(professionals.regularizeToken, token),
        gt(professionals.regularizeTokenExpiresAt, new Date()),
        isNull(professionals.deletedAt),
      ),
    )
    .limit(1);
  if (!prof) return NextResponse.json({ error: 'El enlace venció o ya no es válido.' }, { status: 404 });

  try {
    return NextResponse.json({ initPoint: await createCheckoutForProfessional(prof) });
  } catch (err) {
    console.error('[regularizar] no se pudo crear el checkout', err);
    return NextResponse.json({ error: 'No pudimos iniciar el pago. Probá de nuevo en unos minutos.' }, { status: 502 });
  }
}
