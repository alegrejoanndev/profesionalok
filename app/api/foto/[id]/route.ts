import { NextResponse, type NextRequest } from 'next/server';
import { readPhoto } from '@/lib/storage';

export const runtime = 'nodejs';

/** Foto de perfil (ya recortada y optimizada). Es pública; el id es un UUID imposible de adivinar. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const buf = await readPhoto(id);
  if (!buf) return new NextResponse('No encontrada', { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
