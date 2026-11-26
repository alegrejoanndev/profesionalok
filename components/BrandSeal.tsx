import { SELLO_PATH, SELLO_VIEWBOX } from '@/lib/brand-paths';
import { COLORS } from '@/lib/colors';

/** Sello de ProfesionalesOK (propuesta final): borde ondulado, burbuja "Pok" y "Todos en un mismo lugar". */
export function BrandSeal({ className = '', color = COLORS.aqua }: { className?: string; color?: string }) {
  return (
    <svg viewBox={SELLO_VIEWBOX} aria-hidden="true" focusable="false" className={className}>
      <path d={SELLO_PATH} fill={color} fillRule="evenodd" />
    </svg>
  );
}
