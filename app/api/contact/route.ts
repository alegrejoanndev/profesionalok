import { NextResponse, type NextRequest } from 'next/server';
import { contactMessages } from '@/db/schema';
import { getDb, hasDatabase } from '@/lib/db';
import { sendContactNotification } from '@/lib/email';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { contactSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!rateLimit(`contact:${clientIp(req.headers)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Enviaste muchos mensajes. Probá de nuevo en una hora.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);

  // Honeypot completo = bot: respondemos "ok" sin hacer nada
  if (body && typeof body === 'object' && 'website' in body && body.website) return NextResponse.json({ ok: true });

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return NextResponse.json({ error: 'Revisá los campos marcados.', fieldErrors }, { status: 400 });
  }

  const { name, email, topic, message } = parsed.data;

  if (hasDatabase()) await getDb().insert(contactMessages).values({ name, email, topic, message });
  try {
    await sendContactNotification({ name, email, topic, message });
  } catch (err) {
    console.error('[contact] no se pudo enviar el aviso por mail:', err); // el mensaje igual quedó guardado
  }
  return NextResponse.json({ ok: true });
}
