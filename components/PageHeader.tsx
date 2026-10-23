import { Seal } from './Seal';

/** Encabezado de las páginas internas: título + bajada, con el sello como fondo. */
export function PageHeader({ title, intro, tone = 'text-mint' }: { title: string; intro?: string; tone?: string }) {
  return (
    <section className="relative overflow-hidden border-b border-ink/10">
      <Seal className={`pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] ${tone}`} />
      <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
        <h1 className="max-w-3xl font-display text-[clamp(2.8rem,7vw,5rem)] leading-[.95] tracking-wide">{title}</h1>
        {intro && <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-ink-soft">{intro}</p>}
      </div>
    </section>
  );
}
