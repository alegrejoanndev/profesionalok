/**
 * Paleta de marca.
 * Los 6 primeros HEX se muestrearon del PDF del moodboard (página "Paleta de colores").
 * Si tenés los HEX originales de Canva, reemplazalos acá: es el único lugar donde viven.
 *
 * ink / inkSoft / paper son NEUTROS DERIVADOS (no están en el moodboard): se agregaron
 * para tener texto legible (contraste AA) y un fondo limpio. Tienen el tono del verde agua.
 */
export const COLORS = {
  // Protagonistas / complementarios
  aqua: '#04E1CD', // serenidad, salud
  mint: '#B3F7D7', // calma
  lime: '#BFF17C', // energía, tecnología
  // Opuestos, para resaltar
  lavender: '#CB9DE4', // calma, paz mental
  pink: '#F73E8C', // presencia, confianza
  // Gris institucional (portada y pie del moodboard)
  ash: '#B2B3B8',
  // Neutros derivados
  ink: '#082220',
  inkSoft: '#3E5A57',
  paper: '#F6FDFB',
} as const;

export type Tone = 'aqua' | 'mint' | 'lime' | 'lavender';
