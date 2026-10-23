import { SITE } from '@/lib/site';

/**
 * Logotipo tipográfico: "PROFESIONALES" + "OK" resaltado en aqua (el mismo recurso del moodboard).
 * Usa Bebas Neue, la tipografía de marca del moodboard.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] font-display leading-none tracking-wide text-ink ${className}`}>
      <span className="sr-only">{SITE.name}</span>
      <span aria-hidden="true">PROFESIONALES</span>
      <span aria-hidden="true" className="rounded-md bg-aqua px-1.5 pb-[2px] pt-[5px]">
        OK
      </span>
    </span>
  );
}
