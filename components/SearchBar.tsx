'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { ChevronDown, MapPin, Search, Stethoscope } from 'lucide-react';
import { AGE_GROUPS, ALL_APPROACHES, MODALITIES, OBRAS_SOCIALES, SPECIALTIES, approachesFor, specialtiesFor } from '@/lib/catalog';
import { PROFESSIONS } from '@/lib/professions';

export type SearchFilters = {
  profesion?: string;
  especialidad?: string;
  edad?: string;
  corriente?: string;
  obra?: string;
  modalidad?: string;
  zona?: string;
};

const select = 'w-full rounded-2xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-4 focus:ring-aqua/40';

export function SearchBar({ initial = {}, localities = [] }: { initial?: SearchFilters; localities?: string[] }) {
  const router = useRouter();
  const uid = useId();
  const [f, setF] = useState<Required<SearchFilters>>({
    profesion: initial.profesion ?? '',
    especialidad: initial.especialidad ?? '',
    edad: initial.edad ?? '',
    corriente: initial.corriente ?? '',
    obra: initial.obra ?? '',
    modalidad: initial.modalidad ?? '',
    zona: initial.zona ?? '',
  });
  // Las sugerencias de localidades (<datalist>) se agregan recién cuando la página ya cargó: son solo una ayuda
  // y así no participan de la hidratación (con muchas opciones causaban un aviso intermitente de React).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const advancedActive = !!(initial.especialidad || initial.corriente || initial.obra || initial.modalidad);
  const [moreOpen, setMoreOpen] = useState(advancedActive);

  const set = (patch: Partial<Required<SearchFilters>>) => setF((p) => ({ ...p, ...patch }));

  function onProfesion(slug: string) {
    // Si cambia la profesión, se descartan las especialidades y corrientes que ya no corresponden
    set({
      profesion: slug,
      especialidad: slug && !specialtiesFor(slug).includes(f.especialidad) ? '' : f.especialidad,
      corriente: slug && !approachesFor(slug).includes(f.corriente) ? '' : f.corriente,
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v.trim()) params.set(k, v.trim());
    router.push(`/profesionales${params.size ? `?${params}` : ''}`);
  }

  const specialtyOptions = f.profesion ? specialtiesFor(f.profesion) : null;
  const showApproaches = !f.profesion || approachesFor(f.profesion).length > 0;
  const approachOptions = f.profesion ? approachesFor(f.profesion) : ALL_APPROACHES;

  return (
    <form action="/profesionales" method="get" onSubmit={onSubmit} role="search" aria-label="Buscar profesionales" className="space-y-3">
      <div className="grid gap-2 rounded-[28px] border border-ink/10 bg-white p-2 shadow-[0_20px_50px_-30px_rgba(8,34,32,.55)] transition-shadow duration-300 focus-within:shadow-[0_24px_60px_-28px_rgba(8,34,32,.7)] sm:grid-cols-[.85fr_1.4fr_auto]">
        <label className="group flex items-center gap-3 rounded-[22px] px-4 py-2.5 transition hover:bg-mint/50 focus-within:bg-mint/50">
          <Stethoscope className="h-5 w-5 shrink-0 text-ink-soft" strokeWidth={1.75} />
          <span className="flex w-full flex-col">
            <span className="text-xs font-medium text-ink-soft">Profesión</span>
            <select
              name="profesion"
              value={f.profesion}
              onChange={(e) => onProfesion(e.target.value)}
              className="w-full bg-transparent py-0.5 text-base text-ink outline-none"
            >
              <option value="">Todas</option>
              {PROFESSIONS.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="group flex items-center gap-3 rounded-[22px] px-4 py-2.5 transition hover:bg-mint/50 focus-within:bg-mint/50">
          <MapPin className="h-5 w-5 shrink-0 text-ink-soft" strokeWidth={1.75} />
          <span className="flex w-full flex-col">
            <span className="text-xs font-medium text-ink-soft">Localidad</span>
            <input
              type="text"
              name="zona"
              value={f.zona}
              onChange={(e) => set({ zona: e.target.value })}
              placeholder="Ej: Romang, Villa Ocampo"
              autoComplete="off"
              list={mounted ? `${uid}-localidades` : undefined}
              aria-describedby={`${uid}-zona-hint`}
              className="w-full bg-transparent py-0.5 text-base text-ink outline-none placeholder:text-ink-soft/70"
            />
            {mounted && (
              <datalist id={`${uid}-localidades`}>
                {localities.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            )}
          </span>
        </label>

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-aqua px-7 py-4 text-base font-semibold text-ink transition duration-200 hover:bg-lime active:scale-[.98]"
        >
          <Search className="h-5 w-5" strokeWidth={2} />
          Buscar
        </button>
      </div>
      <p id={`${uid}-zona-hint`} className="px-2 text-xs text-ink-soft">
        Podés buscar en varias localidades a la vez, separadas por coma.
      </p>

      {/* Edad: niños, adolescentes o adultos */}
      <fieldset className="px-1">
        <legend className="mb-2 px-1 text-xs font-medium text-ink-soft">Edad de quien consulta</legend>
        <div className="flex flex-wrap gap-2">
          {[{ value: '', label: 'Todas', hint: '' }, ...AGE_GROUPS].map((a) => (
            <label key={a.value || 'all'} className="cursor-pointer">
              <input
                type="radio"
                name="edad"
                value={a.value}
                checked={f.edad === a.value}
                onChange={() => set({ edad: a.value })}
                className="peer sr-only"
              />
              <span
                title={a.hint || undefined}
                className="inline-block rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-medium transition duration-200 hover:border-ink/40 peer-checked:border-ink peer-checked:bg-lime peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2"
              >
                {a.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Más filtros: especialidad, corriente, obra social, modalidad */}
      <div className="px-1">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls={`${uid}-mas`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold underline decoration-pink decoration-2 underline-offset-8"
        >
          Más filtros
          <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
        </button>

        <div id={`${uid}-mas`} className={`${moreOpen ? 'grid' : 'hidden'} mt-4 gap-4 rounded-[24px] bg-mint/50 p-4 sm:grid-cols-2`}>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Especialidad</span>
            <select name="especialidad" value={f.especialidad} onChange={(e) => set({ especialidad: e.target.value })} className={select}>
              <option value="">Todas</option>
              {specialtyOptions
                ? specialtyOptions.map((s) => <option key={s}>{s}</option>)
                : PROFESSIONS.filter((p) => SPECIALTIES[p.slug]).map((p) => (
                    <optgroup key={p.slug} label={p.label}>
                      {SPECIALTIES[p.slug].map((s) => (
                        <option key={`${p.slug}-${s}`} value={s}>
                          {s}
                        </option>
                      ))}
                    </optgroup>
                  ))}
            </select>
          </label>

          {showApproaches && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Corriente (Psicología)</span>
              <select name="corriente" value={f.corriente} onChange={(e) => set({ corriente: e.target.value })} className={select}>
                <option value="">Todas</option>
                {approachOptions.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Obra social</span>
            <select name="obra" value={f.obra} onChange={(e) => set({ obra: e.target.value })} className={select}>
              <option value="">Todas</option>
              {OBRAS_SOCIALES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Modalidad de atención</span>
            <select name="modalidad" value={f.modalidad} onChange={(e) => set({ modalidad: e.target.value })} className={select}>
              <option value="">Presencial u online</option>
              {MODALITIES.filter((m) => m.value !== 'AMBAS').map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </form>
  );
}
