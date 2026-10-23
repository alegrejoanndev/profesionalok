import type { ReactNode } from 'react';

/**
 * El "sello" de la marca: un círculo con borde ondulado (la tercera forma de
 * "Formatos generales" del moodboard). Se genera por código para poder usarlo
 * como ícono, avatar, fondo y animación con el mismo contorno.
 */
export function sealPath(bumps = 18, depth = 0.035, r = 46, c = 50, steps = 180) {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rad = r * (1 + depth * Math.cos(bumps * t));
    d += `${i === 0 ? 'M' : 'L'}${(c + rad * Math.cos(t)).toFixed(2)} ${(c + rad * Math.sin(t)).toFixed(2)} `;
  }
  return `${d}Z`;
}

const SEAL_PATH = sealPath();

type SealProps = {
  className?: string;
  fill?: string;
  children?: ReactNode;
};

/** Sello decorativo. El color por defecto es el `color` del texto (usá text-mint, text-ink, etc.). */
export function Seal({ className, fill = 'currentColor', children }: SealProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <path d={SEAL_PATH} fill={fill} />
      {children}
    </svg>
  );
}
