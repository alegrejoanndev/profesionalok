import { NextResponse, type NextRequest } from 'next/server';

/**
 * Protege /admin con usuario y contraseña (HTTP Basic).
 * Sin ADMIN_PASSWORD el panel queda deshabilitado (devuelve 404), para no dejarlo abierto por olvido.
 * Para un panel con varios usuarios o roles, reemplazalo por un sistema de login real (Auth.js, Clerk, etc.).
 */
function safeEqual(a: string, b: string) {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse('No encontrado', { status: 404 });

  const [scheme, encoded] = (req.headers.get('authorization') ?? '').split(' ');
  if (scheme === 'Basic' && encoded) {
    try {
      const decoded = atob(encoded);
      const i = decoded.indexOf(':');
      const user = decoded.slice(0, i);
      const pass = decoded.slice(i + 1);
      if (safeEqual(user, process.env.ADMIN_USER ?? 'admin') && safeEqual(pass, password)) {
        const res = NextResponse.next();
        res.headers.set('Cache-Control', 'private, no-store');
        res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return res;
      }
    } catch {
      /* credenciales mal formadas */
    }
  }
  return new NextResponse('Se requiere autenticación.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Panel interno", charset="UTF-8"' },
  });
}

export const config = { matcher: ['/admin/:path*'] };
