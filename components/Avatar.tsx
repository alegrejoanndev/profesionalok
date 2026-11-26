import { BURBUJA_PATH, BURBUJA_VIEWBOX } from '@/lib/brand-paths';
import { COLORS, type Tone } from '@/lib/colors';

const BG: Record<Tone, string> = {
  aqua: 'bg-aqua',
  mint: 'bg-mint',
  lime: 'bg-lime',
  lavender: 'bg-lavender',
};

/** El logo de la marca (la burbuja "Pok" de ProfesionalesOK). Se usa cuando el profesional no sube foto. */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox={BURBUJA_VIEWBOX} className={className} aria-hidden="true" focusable="false">
      <path d={BURBUJA_PATH} fill={COLORS.aqua} fillRule="evenodd" />
    </svg>
  );
}

type AvatarProps = {
  name: string;
  photoUrl?: string | null;
  tone?: Tone;
  className?: string;
};

/**
 * Foto de perfil REDONDA. Es opcional: si no hay foto se muestra el logo de ProfesionalesOk.
 * El tamaño se define con className (ej: "h-20 w-20").
 */
export function Avatar({ name, photoUrl, tone = 'aqua', className = '' }: AvatarProps) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-ink/10 ${photoUrl ? BG[tone] : 'bg-paper'} ${className}`}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={`Foto de ${name}`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <>
          <LogoMark className="h-[66%] w-[66%]" />
          <span className="sr-only">{name} (sin foto: se muestra el logo de ProfesionalesOk)</span>
        </>
      )}
    </span>
  );
}
