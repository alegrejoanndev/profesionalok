import { MessageCircle } from 'lucide-react';
import { SITE } from '@/lib/site';

/** Botón flotante de WhatsApp (en todas las páginas): abre el chat con el número del sitio. */
export function WhatsAppButton() {
  const href = `${SITE.phoneWhatsapp}?text=${encodeURIComponent(`Hola, vengo de ${SITE.name} y quisiera hacer una consulta.`)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-whatsapp="float"
      aria-label={`Escribinos por WhatsApp al ${SITE.phoneDisplay}`}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-lime px-4 py-3 text-sm font-semibold text-ink shadow-[0_14px_34px_-14px_rgba(8,34,32,.65)] transition duration-200 hover:-translate-y-0.5 hover:bg-aqua active:translate-y-0 sm:px-5"
    >
      <MessageCircle className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      <span>WhatsApp</span>
    </a>
  );
}
