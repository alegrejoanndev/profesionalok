import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactForm';
import { PageHeader } from '@/components/PageHeader';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Contacto' };

export default function ContactoPage() {
  return (
    <>
      <PageHeader title="Contacto" intro="Escribinos por dudas, soporte o consultas sobre tu suscripción." tone="text-lavender" />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.2fr_.8fr]">
        <ContactForm />
        <aside className="h-fit rounded-[28px] bg-mint p-7">
          <h2 className="text-lg font-semibold">Antes de escribir</h2>
          <ul className="mt-3 space-y-3 text-ink-soft">
            <li>Si buscás atención de salud, contactá directamente al profesional desde su perfil.</li>
            <li>Si sos profesional y tu perfil no aparece, revisá tu mail: te avisamos si falló un cobro.</li>
            <li>Para urgencias médicas, llamá al servicio de emergencias de tu zona. Este sitio no brinda atención de salud.</li>
          </ul>
          <p className="mt-5 text-sm">
            También podés escribirnos a{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="font-semibold underline underline-offset-4">{SITE.contactEmail}</a>.
          </p>
          <p className="mt-3 text-sm">
            O comunicarte por teléfono o WhatsApp al{' '}
            <a href={`tel:+54${SITE.phone}`} className="font-semibold underline underline-offset-4">{SITE.phoneDisplay}</a>
            {' '}(<a href={SITE.phoneWhatsapp} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">abrir WhatsApp</a>).
          </p>
        </aside>
      </div>
    </>
  );
}
