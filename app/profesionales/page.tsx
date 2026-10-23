import type { Metadata } from 'next';
import Link from 'next/link';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { PageHeader } from '@/components/PageHeader';
import { SearchBar } from '@/components/SearchBar';
import type { Tone } from '@/lib/colors';
import { AGE_GROUPS, ALL_APPROACHES, ALL_SPECIALTIES, MODALITIES, OBRAS_SOCIALES, parseZonas } from '@/lib/catalog';
import { getLocalitySuggestions, searchProfessionals } from '@/lib/professionals';
import { getProfession } from '@/lib/professions';
import { CTA } from '@/lib/site';

export const metadata: Metadata = { title: 'Directorio de profesionales' };
export const dynamic = 'force-dynamic'; // depende de los filtros de la URL

const TONES: Tone[] = ['aqua', 'lime', 'lavender', 'mint'];
const PAGE_SIZE = 12;

type Props = {
  searchParams: Promise<{
    profesion?: string; especialidad?: string; edad?: string; corriente?: string; obra?: string;
    modalidad?: string; zona?: string; page?: string;
  }>;
};

const clean = (v?: string, max = 80) => v?.trim().slice(0, max) || undefined;

export default async function DirectorioPage({ searchParams }: Props) {
  const sp = await searchParams;
  // Compatibilidad: antes la profesión viajaba como ?especialidad=psicologia
  const legacy = sp.especialidad && getProfession(sp.especialidad) ? sp.especialidad : undefined;
  const profesion = (sp.profesion && getProfession(sp.profesion) ? sp.profesion : undefined) ?? legacy;
  const especialidad = legacy ? undefined : clean(sp.especialidad) && ALL_SPECIALTIES.includes(clean(sp.especialidad)!) ? clean(sp.especialidad) : undefined;
  const edad = AGE_GROUPS.some((a) => a.value === sp.edad) ? sp.edad : undefined;
  const corriente = clean(sp.corriente) && ALL_APPROACHES.includes(clean(sp.corriente)!) ? clean(sp.corriente) : undefined;
  const obra = clean(sp.obra) && OBRAS_SOCIALES.includes(clean(sp.obra)!) ? clean(sp.obra) : undefined;
  const modalidad = sp.modalidad === 'PRESENCIAL' || sp.modalidad === 'ONLINE' ? sp.modalidad : undefined;
  const zona = clean(sp.zona, 120);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const filters = { profesion, especialidad, edad, corriente, obra, modalidad, zona };
  const [{ items, total, demo }, localities] = await Promise.all([
    searchProfessionals({ ...filters, page, pageSize: PAGE_SIZE }),
    getLocalitySuggestions(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/profesionales${s ? `?${s}` : ''}`;
  };
  const active = [
    profesion && getProfession(profesion)?.label,
    especialidad,
    edad && AGE_GROUPS.find((a) => a.value === edad)?.label,
    corriente,
    obra,
    modalidad && MODALITIES.find((m) => m.value === modalidad)?.label,
    ...parseZonas(zona),
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        title="Directorio de profesionales"
        intro="Todos los perfiles tienen su matrícula y su título controlados antes de publicarse."
      />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="max-w-3xl">
          <SearchBar key={JSON.stringify(filters)} initial={filters} localities={localities} />
        </div>

        {demo && (
          <p className="mt-6 rounded-2xl bg-lime px-5 py-3 text-sm font-medium">
            Estás viendo datos de ejemplo porque todavía no hay una base de datos conectada.
          </p>
        )}

        <p className="mt-8 text-sm text-ink-soft" role="status" aria-live="polite">
          {total === 0
            ? 'Sin resultados'
            : `${total} ${total === 1 ? 'profesional' : 'profesionales'}`}
          {active.length > 0 && ` · ${active.join(' · ')}`}
        </p>

        {items.length > 0 ? (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((p, i) => (
              <ProfessionalCard key={p.id} p={p} tone={TONES[i % TONES.length]} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[28px] border border-dashed border-ink/25 p-10">
            <p className="text-lg font-semibold">No encontramos profesionales con esos filtros</p>
            <p className="mt-2 max-w-[56ch] text-ink-soft">
              Probá con otra localidad o con menos filtros. Si sos profesional de la salud, podés sumar tu perfil.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/profesionales" className="rounded-full border border-ink/20 px-6 py-3 font-semibold transition hover:bg-mint">
                Quitar filtros
              </Link>
              <Link href={CTA.href} className="rounded-full bg-pink px-6 py-3 font-semibold transition hover:bg-lavender">
                {CTA.label}
              </Link>
            </div>
          </div>
        )}

        {pages > 1 && (
          <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link href={qs(page - 1)} className="rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold transition hover:bg-mint">
                Anterior
              </Link>
            )}
            <span className="px-3 text-sm text-ink-soft">
              Página {page} de {pages}
            </span>
            {page < pages && (
              <Link href={qs(page + 1)} className="rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold transition hover:bg-mint">
                Siguiente
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
