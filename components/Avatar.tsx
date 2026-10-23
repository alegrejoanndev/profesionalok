import { Seal } from './Seal';
import { COLORS, type Tone } from '@/lib/colors';

const BG: Record<Tone, string> = {
  aqua: 'bg-aqua',
  mint: 'bg-mint',
  lime: 'bg-lime',
  lavender: 'bg-lavender',
};

/** El logo de la marca (sello con tilde). Se usa cuando el profesional no sube foto. */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <Seal className={className} fill={COLORS.paper}>
      <path
        d="M33 51 L45 63 L68 37"
        fill="none"
        stroke={COLORS.ink}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Seal>
  );
}

type AvatarProps = {
  name: string;
  photoUrl?: string | null;
  tone?: Tone;
  className?: string;
};

/**
 * Foto de perfil REDONDA. Es opcional: si no hay foto se muestra el logo de profesionalesok.
 * El tamaño se define con className (ej: "h-20 w-20").
 */
export function Avatar({ name, photoUrl, tone = 'aqua', className = '' }: AvatarProps) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-ink/10 ${BG[tone]} ${className}`}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={`Foto de ${name}`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <>
          <LogoMark className="h-[62%] w-[62%]" />
          <span className="sr-only">{name} (sin foto: se muestra el logo de profesionalesok)</span>
        </>
      )}
    </span>
  );
}
