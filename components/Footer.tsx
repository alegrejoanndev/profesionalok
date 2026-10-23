import Link from 'next/link';
import { Seal } from './Seal';
import { Wordmark } from './Wordmark';
import { COLORS } from '@/lib/colors';
import { NAV_LINKS, SITE } from '@/lib/site';

export function Footer() {
  return (
    <footer className="bg-ash text-ink">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Seal className="h-9 w-9 text-paper">
              <path
                d="M33 51 L45 63 L68 37"
                fill="none"
                stroke={COLORS.ink}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Seal>
            <Wordmark className="text-[1.65rem]" />
          </div>
          <p className="mt-3 font-serif text-lg italic">{SITE.tagline}</p>
          <p className="mt-5 max-w-md text-sm leading-relaxed">
            Los datos personales y de salud se tratan conforme a la Ley 25.326 de Protección de los
            Datos Personales. Consultá los términos para conocer cómo los usamos.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <a href={`mailto:${SITE.contactEmail}`} className="font-semibold underline underline-offset-4">{SITE.contactEmail}</a>
            <a href={`tel:+54${SITE.phone}`} className="font-semibold underline underline-offset-4">Tel. {SITE.phoneDisplay}</a>
          </p>
        </div>

        <nav aria-label="Pie de página">
          <ul className="space-y-1 text-sm font-medium md:text-right">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-block py-1.5 underline-offset-4 transition hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-ink/15">
        <p className="mx-auto max-w-6xl px-5 py-4 text-xs sm:px-8">
          © {new Date().getFullYear()} {SITE.name} · {SITE.domain}
        </p>
      </div>
    </footer>
  );
}
