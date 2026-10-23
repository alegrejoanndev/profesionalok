import { BadgeCheck, HeartHandshake, MapPin, MessageCircle, Users, Video } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Tone } from '@/lib/colors';
import { ageLabel, modalityLabel } from '@/lib/catalog';
import { LICENSE_SHORT, getProfession } from '@/lib/professions';
import type { PublicProfessional } from '@/lib/professionals';
import { SITE } from '@/lib/site';

const MAX_CHIPS = 3;
const MAX_OBRAS = 3;

export function ProfessionalCard({ p, tone = 'aqua' }: { p: PublicProfessional; tone?: Tone }) {
  const fullName = `${p.firstName} ${p.lastName}`;
  const professionLabel = getProfession(p.profession)?.label ?? p.profession;
  const whatsapp = `https://wa.me/${p.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hola ${p.firstName}, te encontré en ${SITE.name} y quisiera consultarte por un turno.`,
  )}`;
  const chips = [...p.specialties, ...p.corrientes];
  const ages = AGE_ORDER.filter((a) => p.ageGroups.includes(a)).map(ageLabel);
  const obras = p.obrasSociales.slice(0, MAX_OBRAS);

  return (
    <article className="group flex h-full flex-col rounded-[28px] border border-ink/10 bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_18px_40px_-24px_rgba(8,34,32,.5)]">
      <div className="flex items-start gap-4">
        <Avatar
          name={fullName}
          photoUrl={p.photoUrl}
          tone={tone}
          className="h-20 w-20 transition-transform duration-500 group-hover:scale-105"
        />
        <div className="min-w-0 pt-1">
          <h3 className="text-lg font-semibold leading-tight">{fullName}</h3>
          <p className="mt-1 text-sm text-ink-soft">{professionLabel}</p>
        </div>
      </div>

      {chips.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Especialidades y corrientes">
          {chips.slice(0, MAX_CHIPS).map((c) => (
            <li key={c} className="rounded-full bg-mint px-3 py-1 text-xs font-medium">
              {c}
            </li>
          ))}
          {chips.length > MAX_CHIPS && (
            <li className="rounded-full bg-mint/60 px-3 py-1 text-xs font-medium">+{chips.length - MAX_CHIPS}</li>
          )}
        </ul>
      )}

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <dt className="sr-only">Matrícula</dt>
          <dd>
            {LICENSE_SHORT[p.licenseType] ?? p.licenseType} {p.licenseNumber}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <dt className="sr-only">Zona</dt>
          <dd>
            {p.city}, {p.province}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <dt className="sr-only">Modalidad de atención</dt>
          <dd>{modalityLabel(p.modalidad)}</dd>
        </div>
        {ages.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <dt className="sr-only">Atiende a</dt>
            <dd>{ages.join(' · ')}</dd>
          </div>
        )}
        {obras.length > 0 && (
          <div className="flex items-start gap-2">
            <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <dt className="sr-only">Obras sociales</dt>
            <dd className="leading-snug">
              {obras.join(', ')}
              {p.obrasSociales.length > MAX_OBRAS && (
                <span className="text-ink-soft"> y {p.obrasSociales.length - MAX_OBRAS} más</span>
              )}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-auto pt-6">
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-pink hover:text-ink"
        >
          <MessageCircle className="h-4 w-4" strokeWidth={2} />
          Contactar
          <span className="sr-only"> a {fullName} por WhatsApp</span>
        </a>
      </div>
    </article>
  );
}

const AGE_ORDER = ['ninos', 'adolescentes', 'adultos'];
