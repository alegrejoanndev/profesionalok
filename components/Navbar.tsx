'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Seal } from './Seal';
import { Wordmark } from './Wordmark';
import { COLORS } from '@/lib/colors';
import { CTA, NAV_LINKS, SITE } from '@/lib/site';

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cierra el menú móvil al navegar
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-paper/85 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? 'border-ink/10 shadow-[0_8px_24px_-18px_rgba(8,34,32,.5)]' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-1.5 sm:px-8">
        {/* Marca */}
        <Link href="/" className="group flex min-w-0 items-center gap-2.5" aria-label={`${SITE.name} — inicio`}>
          <Seal
            className="hidden h-8 w-8 shrink-0 text-aqua transition-transform duration-500 group-hover:rotate-[24deg] min-[380px]:block sm:h-9 sm:w-9"
          >
            <path
              d="M33 51 L45 63 L68 37"
              fill="none"
              stroke={COLORS.ink}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Seal>
          <Wordmark className="text-[1.2rem] min-[400px]:text-[1.35rem] sm:text-[1.65rem]" />
        </Link>

        {/* Links (escritorio) */}
        <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? 'page' : undefined}
              className="group relative py-2 text-[15px] font-medium text-ink"
            >
              {l.label}
              <span
                className={`absolute inset-x-0 -bottom-0.5 h-0.5 origin-left bg-pink transition-transform duration-300 group-hover:scale-x-100 ${
                  isActive(l.href) ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* CTA principal: siempre visible, también en mobile */}
          <Link
            href={CTA.href}
            className="group inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-pink px-3.5 py-2.5 text-[13px] font-semibold text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-lavender active:translate-y-0 sm:px-5 sm:text-sm"
          >
            <Seal className="hidden h-6 w-6 text-ink transition-transform duration-500 group-hover:rotate-90 sm:block">
              <path d="M50 30v40M30 50h40" stroke={COLORS.pink} strokeWidth="10" strokeLinecap="round" />
            </Seal>
            {CTA.label}
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition hover:bg-mint md:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menú móvil: se expande con una transición suave de altura */}
      <div
        id="menu-movil"
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out md:hidden ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <nav aria-label="Principal (móvil)" className="overflow-hidden">
          <ul className="mx-5 flex flex-col gap-1 border-t border-ink/10 py-3 sm:mx-8">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? 'page' : undefined}
                  className={`block rounded-2xl px-4 py-3 text-base font-medium transition hover:bg-mint ${
                    isActive(l.href) ? 'bg-mint' : ''
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
