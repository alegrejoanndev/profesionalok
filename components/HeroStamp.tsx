import { BadgeCheck, MapPin } from 'lucide-react';
import { Avatar } from './Avatar';
import { sealPath } from './Seal';
import { COLORS } from '@/lib/colors';

const HERO_SEAL = sealPath(20, 0.04, 94, 100, 240);

/**
 * Momento memorable del Home: una tarjeta de perfil de ejemplo y, encima,
 * el sello de verificación que se "estampa" una sola vez al cargar la página.
 * Es 100% CSS (sin JS) y se desactiva con prefers-reduced-motion.
 * La tarjeta es ilustrativa (datos ficticios) y por eso está oculta a lectores de pantalla.
 */
export function HeroStamp() {
  return (
    <div className="relative mx-auto w-full max-w-sm pb-16 pr-6 lg:max-w-md" aria-hidden="true">
      {/* Tarjeta de ejemplo */}
      <div className="rotate-[2.5deg] rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(8,34,32,.45)]">
        <div className="flex items-center gap-4">
          <Avatar name="Lucía Fernández" tone="lavender" className="h-20 w-20" />
          <div>
            <p className="text-lg font-semibold leading-tight">Dra. Lucía Fernández</p>
            <p className="mt-1 text-sm text-ink-soft">Psicología</p>
          </div>
        </div>

        <div className="mt-5 space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" strokeWidth={1.75} /> M.P. 4821
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4" strokeWidth={1.75} /> Presencial y online
          </p>
        </div>

        <div className="mt-6 h-11 rounded-full bg-ink" />
      </div>

      {/* Sello de verificación */}
      <div className="absolute -bottom-2 right-0 h-44 w-44 sm:h-52 sm:w-52">
        {/* Onda de tinta */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 animate-ink overflow-visible">
          <path d={HERO_SEAL} fill="none" stroke={COLORS.aqua} strokeWidth="3" />
        </svg>

        {/* Sello */}
        <svg
          viewBox="0 0 200 200"
          className="absolute inset-0 animate-stamp drop-shadow-[0_10px_18px_rgba(8,34,32,.25)]"
        >
          <defs>
            {/* Trayecto circular para el texto: arranca a las 9 y gira en sentido horario */}
            <path id="hero-seal-ring" d="M100,100 m-68,0 a68,68 0 1,1 136,0 a68,68 0 1,1 -136,0" />
          </defs>
          <path d={HERO_SEAL} fill={COLORS.aqua} />
          <circle cx="100" cy="100" r="82" fill="none" stroke={COLORS.ink} strokeWidth="1.2" />
          <circle cx="100" cy="100" r="62" fill="none" stroke={COLORS.ink} strokeWidth="1.2" />
          <text
            fontSize="9"
            fontWeight="600"
            letterSpacing="1.55"
            fill={COLORS.ink}
            style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
          >
            <textPath href="#hero-seal-ring">
              matrícula verificada • título controlado • salud con respaldo •
            </textPath>
          </text>
          {/* La tilde: el "ok" del dominio. Se dibuja después de que el sello apoya. */}
          <path
            d="M72 101 L92 121 L130 78"
            fill="none"
            stroke={COLORS.ink}
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            className="animate-draw"
          />
        </svg>
      </div>
    </div>
  );
}
