import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { BadgeCheck, MapPin, MessageCircle } from 'lucide-react';
import { HeroStamp } from '@/components/HeroStamp';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Seal } from '@/components/Seal';
import { SearchBar } from '@/components/SearchBar';
import { COLORS, type Tone } from '@/lib/colors';
import { getFeaturedProfessionals, getLocalitySuggestions } from '@/lib/professionals';
import { trialMonths } from '@/lib/mercadopago';
import { PROFESSIONS } from '@/lib/professions';
import { CTA, SITE } from '@/lib/site';

// Re-genera el Home cada 60 s. El webhook además llama a revalidatePath('/') al dar de baja un perfil.
export const revalidate = 60;

const TONES: Tone[] = ['aqua', 'lime', 'lavender', 'mint'];
const CHIP_HOVER = ['hover:bg-mint', 'hover:bg-lime', 'hover:bg-lavender'];

const VALUE_ITEMS: { icon: LucideIcon; seal: string; title: string; text: string }[] = [
  {
    icon: BadgeCheck,
    seal: COLORS.aqua,
    title: 'Matrícula y título controlados',
    text: 'Verificamos la matrícula y revisamos la documentación de cada profesional antes de publicar su perfil.',
  },
  {
    icon: MessageCircle,
    seal: COLORS.lime,
    title: 'Contacto directo',
    text: 'Le escribís por WhatsApp al profesional, sin intermediarios y sin comisiones por turno.',
  },
  {
    icon: MapPin,
    seal: COLORS.lavender,
    title: 'Solo perfiles activos',
    text: 'Si una suscripción se interrumpe, el perfil sale del directorio hasta que se regularice.',
  },
];

// EJEMPLOS: reemplazar por testimonios reales (con consentimiento) antes de publicar.
const TESTIMONIALS = [
  {
    quote: 'Encontré kinesiología cerca de casa en dos minutos y pude escribirle directo.',
    name: 'Nombre y apellido',
    role: 'Usuario del directorio',
    bg: 'bg-white border border-ink/10',
  },
  {
    quote: 'Desde que sumé mi perfil me llegan consultas de personas que antes no me conocían.',
    name: 'Nombre y apellido',
    role: 'Profesional de la salud',
    bg: 'bg-lime md:translate-y-6',
  },
  {
    quote: 'Me dio tranquilidad ver que la matrícula estaba verificada antes de contactar.',
    name: 'Nombre y apellido',
    role: 'Usuario del directorio',
    bg: 'bg-lavender',
  },
];

const stepsFor = (trial: number) => [
  { title: 'Tus datos', text: 'Profesión, matrícula, edades que atendés y modalidad. Verificamos tu matrícula antes del pago.' },
  { title: 'Tu documentación', text: 'Foto de perfil (opcional) y foto o PDF de tu título.' },
  {
    title: 'Tu suscripción mensual',
    text: trial > 0 ? 'Primer mes gratis, por única vez. Después, débito automático con Mercado Pago.' : 'Pagás con Mercado Pago, con débito automático mensual.',
  },
];

export default async function HomePage() {
  const [featured, localities] = await Promise.all([getFeaturedProfessionals(4), getLocalitySuggestions()]);
  const trial = trialMonths();
  const STEPS = stepsFor(trial);

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden">
        <Seal className="pointer-events-none absolute -right-44 -top-32 h-[380px] w-[380px] text-mint sm:-right-52 sm:-top-44 sm:h-[680px] sm:w-[680px]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.2fr_.8fr] lg:pb-24 lg:pt-16">
          <div>
            <p className="font-serif text-xl italic text-ink-soft">{SITE.tagline}</p>
            <h1 className="mt-3 font-display text-[clamp(3.4rem,9.5vw,6.75rem)] leading-[.92] tracking-wide">
              Encontrá al profesional de la salud que necesitás
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink-soft">
              Cada perfil tiene su matrícula y su título controlados antes de publicarse.
            </p>

            <div className="mt-8 max-w-2xl">
              <SearchBar localities={localities} />
            </div>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Profesiones frecuentes">
              {PROFESSIONS.slice(0, 6).map((p, i) => (
                <li key={p.slug}>
                  <Link
                    href={`/profesionales?profesion=${p.slug}`}
                    className={`inline-block rounded-full border border-ink/15 px-4 py-2 text-sm font-medium transition duration-200 hover:-translate-y-0.5 hover:border-transparent ${CHIP_HOVER[i % 3]}`}
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <HeroStamp />
        </div>
      </section>

      {/* ───────── Profesionales destacados ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20" aria-labelledby="destacados">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="destacados" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Profesionales destacados
          </h2>
          <Link
            href="/profesionales"
            className="text-sm font-semibold underline decoration-pink decoration-2 underline-offset-8 transition hover:decoration-4"
          >
            Ver todo el directorio
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p, i) => (
              <ProfessionalCard key={p.id} p={p} tone={TONES[i % TONES.length]} />
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-[28px] border border-dashed border-ink/25 p-8 text-ink-soft">
            Todavía no hay perfiles destacados. Si sos profesional de la salud,{' '}
            <Link href={CTA.href} className="font-semibold text-ink underline underline-offset-4">
              sumá el tuyo
            </Link>
            .
          </p>
        )}
      </section>

      {/* ───────── Propuesta de valor ───────── */}
      <section className="bg-mint" aria-labelledby="valor">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-24">
          <div>
            <h2 id="valor" className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Un directorio donde la matrícula va primero
            </h2>
            <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-ink-soft">
              Pensado para que cualquier persona encuentre atención de salud sin vueltas, y para que cada
              profesional tenga un lugar propio donde ser encontrado.
            </p>
          </div>

          <ul className="space-y-7">
            {VALUE_ITEMS.map(({ icon: Icon, seal, title, text }) => (
              <li key={title} className="group flex gap-5">
                <span className="relative grid h-16 w-16 shrink-0 place-items-center">
                  <Seal
                    className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:rotate-[18deg]"
                    fill={seal}
                  />
                  <Icon className="relative h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-1 max-w-[52ch] leading-relaxed text-ink-soft">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Testimonios ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24" aria-labelledby="testimonios">
        <h2 id="testimonios" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Lo que cuentan quienes ya lo usan
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3 md:pb-6">
          {TESTIMONIALS.map((t) => (
            <figure key={t.quote} className={`flex flex-col justify-between rounded-[28px] p-7 ${t.bg}`}>
              <blockquote className="font-serif text-xl italic leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="mt-6 text-sm">
                <span className="font-semibold">{t.name}</span>
                <span className="block text-ink-soft">{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ───────── Para profesionales ───────── */}
      <section className="bg-aqua" aria-labelledby="profesionales">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1fr] lg:items-center lg:py-20">
          <div>
            <h2 id="profesionales" className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              ¿Sos profesional de la salud? Sumá tu perfil al directorio
            </h2>
            <p className="mt-4 max-w-[48ch] text-lg leading-relaxed">
              {trial > 0 ? `El primer ${trial === 1 ? 'mes' : `${trial} meses`} es gratis, por única vez. Después, es una suscripción mensual con débito automático.` : 'Es una suscripción mensual con débito automático.'} Armás tu perfil en tres pasos.
            </p>
            <Link
              href={CTA.href}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-pink px-7 py-4 text-base font-semibold text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0"
            >
              {CTA.label}
            </Link>
          </div>

          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-center gap-4 rounded-[24px] bg-paper/70 p-4 pr-6">
                <span className="relative grid h-12 w-12 shrink-0 place-items-center font-display text-2xl">
                  <Seal className="absolute inset-0 h-full w-full text-aqua" fill={COLORS.mint} />
                  <span className="relative">{i + 1}</span>
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-ink-soft">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
