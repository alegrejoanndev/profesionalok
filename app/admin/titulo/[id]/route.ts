import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { professionals } from '@/db/schema';
import { getDb } from '@/lib/db';
import { readTitle } from '@/lib/storage';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Título de un profesional. Solo accesible con la contraseña del panel (lo protege middleware.ts). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p] = await getDb().select({ path: professionals.titleDocPath }).from(professionals).where(eq(professionals.id, id));
  const buf = p?.path ? await readTitle(p.path) : null;
  if (!p?.path || !buf) return new NextResponse('No encontrado', { status: 404 });

  const ext = p.path.split('.').pop() ?? '';
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
