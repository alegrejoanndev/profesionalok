import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { COLORS } from '@/lib/colors';
import { SITE } from '@/lib/site';

// Tipografías extraídas del PDF del moodboard (archivos locales en app/fonts: no dependen de Google Fonts)
const poppins = localFont({
  src: [
    { path: './fonts/poppins-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/poppins-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/poppins-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});
const bebas = localFont({
  src: [{ path: './fonts/bebas-neue-latin-400-normal.woff2', weight: '400', style: 'normal' }],
  variable: '--font-bebas',
  display: 'swap',
});
const lora = localFont({
  src: [
    { path: './fonts/lora-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/lora-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/lora-latin-400-italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-lora',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — Profesionales de la salud con matrícula verificada`, template: `%s · ${SITE.name}` },
  description:
    'Directorio de profesionales de la salud. Cada perfil tiene su matrícula y su título controlados antes de publicarse.',
  openGraph: { siteName: SITE.name, locale: 'es_AR', type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: COLORS.paper,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className={`${poppins.variable} ${bebas.variable} ${lora.variable} flex min-h-screen flex-col font-sans`}>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-white"
        >
          Saltar al contenido
        </a>
        <Navbar />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
