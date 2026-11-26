import { SITE } from '@/lib/site';
import { LOGO_PATH, LOGO_VIEWBOX } from '@/lib/brand-paths';
import { COLORS } from '@/lib/colors';

/**
 * Logotipo horizontal de ProfesionalesOK (burbuja "Pok" + nombre). Se dibuja en aqua;
 * sobre fondos grises o muy claros se puede pasar otro color (por ejemplo COLORS.ink).
 */
export function Logo({ className = '', color = COLORS.aqua }: { className?: string; color?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} role="img" aria-label={SITE.name} className={className} focusable="false">
      <path d={LOGO_PATH} fill={color} fillRule="evenodd" />
    </svg>
  );
}
