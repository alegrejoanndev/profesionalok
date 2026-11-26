import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { refreshCpsf } from '@/lib/cpsf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Actualiza la copia del padrón del Colegio de Psicólogos de Santa Fe. Llamalo una vez por día:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/cpsf
 * Así, ninguna persona que se está dando de alta espera a que se lea el padrón completo.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const valid = !!secret && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!valid) return new NextResponse('No autorizado', { status: 401 });
  try {
    return NextResponse.json(await refreshCpsf());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
