export const SITE = {
  // Cambiá el nombre acá y se actualiza en todo el sitio (el logotipo está en components/Wordmark.tsx).
  name: 'ProfesionalesOk',
  domain: 'profesionalesok.com.ar',
  tagline: 'Todos en un solo lugar.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://profesionalesok.com.ar',
  /** Casilla pública de contacto (la que se muestra en el sitio). Cambiala por la real si es otra. */
  contactEmail: 'Profesionaleshoy.rqta@gmail.com',
  /** Teléfono / WhatsApp de contacto del sitio. */
  phone: '3482204388',
  phoneDisplay: '3482 204388',
  phoneWhatsapp: 'https://wa.me/5493482204388',
  /** Link de suscripción de Mercado Pago (se usa con MP_SUBSCRIPTION_LINK en el entorno; ver README). */
  paymentLink: 'https://mpago.la/1TeHYiV',
} as const;

/** Versión de los términos que acepta el profesional. Subila cuando cambies el texto legal. */
export const TERMS_VERSION = '2026-10-borrador-2';

export const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/profesionales', label: 'Profesionales' },
  { href: '/contacto', label: 'Contacto' },
  { href: '/terminos', label: 'Términos legales' },
] as const;

export const CTA = { href: '/asociar', label: 'Suma tu perfil' } as const;
