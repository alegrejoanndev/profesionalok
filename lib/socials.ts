/**
 * Redes sociales opcionales del perfil: Instagram, Facebook y LinkedIn (más un WhatsApp propio, que va aparte).
 * El profesional puede escribir el enlace completo o solo su usuario; se guarda siempre un enlace https a la red
 * correspondiente (nunca otro sitio), para que nadie pueda publicar enlaces a cualquier página.
 */
export type SocialKind = 'instagram' | 'facebook' | 'linkedin';

export const SOCIALS: { kind: SocialKind; label: string; placeholder: string; hint: string }[] = [
  { kind: 'instagram', label: 'Instagram', placeholder: '@tuusuario', hint: 'Tu usuario o el enlace a tu perfil.' },
  { kind: 'facebook', label: 'Facebook', placeholder: 'facebook.com/tupagina', hint: 'El enlace a tu perfil o página.' },
  { kind: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/tuusuario', hint: 'El enlace a tu perfil.' },
];

const HOSTS: Record<SocialKind, RegExp> = {
  instagram: /^(www\.|m\.)?instagram\.com$/i,
  facebook: /^(www\.|m\.|web\.)?(facebook\.com|fb\.com)$/i,
  linkedin: /^([a-z]{2,3}\.|www\.)?linkedin\.com$/i,
};
const USER = /^[A-Za-z0-9._-]{2,60}$/;

/** Devuelve el enlace https normalizado, '' si está vacío y null si no es válido. */
export function normalizeSocial(kind: SocialKind, input: string): string | '' | null {
  const raw = input.trim();
  if (!raw) return '';
  if (raw.length > 200 || /\s/.test(raw)) return null;

  // Enlace (con o sin https://)
  if (/[./]/.test(raw) && !/^@/.test(raw) && (/^https?:\/\//i.test(raw) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(raw))) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return null;
    }
    if (!HOSTS[kind].test(url.hostname) || url.username || url.password) return null;
    const path = url.pathname.replace(/\/+$/, '');
    if (!path || path === '/') return null;
    const host = kind === 'linkedin' ? 'www.linkedin.com' : kind === 'instagram' ? 'www.instagram.com' : 'www.facebook.com';
    // Se descartan parámetros de seguimiento: solo se conserva la ruta (y "id" en los enlaces profile.php?id=…)
    const id = kind === 'facebook' && /profile\.php$/i.test(path) ? url.searchParams.get('id') : null;
    if (kind === 'facebook' && /profile\.php$/i.test(path)) return id && /^\d{5,25}$/.test(id) ? `https://${host}/profile.php?id=${id}` : null;
    if (!/^[\w\-./%]+$/.test(path)) return null;
    return `https://${host}${path}`;
  }

  // Solo el usuario
  const user = raw.replace(/^@/, '');
  if (!USER.test(user)) return null;
  if (kind === 'linkedin') return `https://www.linkedin.com/in/${user}`;
  return kind === 'instagram' ? `https://www.instagram.com/${user}` : `https://www.facebook.com/${user}`;
}
