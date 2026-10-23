import crypto from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { professionals } from '@/db/schema';
import { getDb, hasDatabase } from '@/lib/db';
import { matriculaMode } from '@/lib/matricula';
import { revalidateProfessional } from '@/lib/verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH = 25;

/**
 * Revalida periódicamente las matrículas ya aprobadas (una matrícula puede suspenderse con el tiempo).
 * Llamalo una vez por día o por semana desde el programador de tu hosting o de cron-job.org:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/revalidar
 * Procesa hasta 25 perfiles por llamada, empezando por los que hace más tiempo no se revisan.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const valid =
    !!secret &&
    given.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!valid) return new NextResponse('No autorizado', { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'Sin base de datos' }, { status: 503 });
  if (matriculaMode() !== 'refeps') {
    return NextResponse.json({ skipped: 'La validación contra el registro oficial no está activada (MATRICULA_MODE=refeps).' });
  }

  const rows = await getDb()
    .select({ id: professionals.id })
    .from(professionals)
    .where(and(eq(professionals.verificationStatus, 'APPROVED'), isNull(professionals.deletedAt)))
    .orderBy(sql`${professionals.matriculaCheckedAt} asc nulls first`)
    .limit(BATCH);

  const counts: Record<string, number> = {};
  for (const { id } of rows) {
    const { outcome } = await revalidateProfessional(id, 'cron');
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  return NextResponse.json({ processed: rows.length, counts });
}
