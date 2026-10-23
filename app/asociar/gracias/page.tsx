import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, Clock, Mail } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { trialMonths } from '@/lib/mercadopago';

export const metadata: Metadata = { title: '¡Gracias por sumarte!', robots: { index: false } };

const itemsFor = (trial: number) => [
  { icon: Clock, title: 'Matrícula verificada', text: 'Ya la consultamos contra el padrón oficial antes del pago. Si todo coincide, tu perfil se aprueba al instante; si no, una persona revisa tu título (uno o dos días hábiles).' },
  {
    icon: BadgeCheck,
    title: trial > 0 ? 'Empieza tu mes gratis' : 'Se acredita tu primer cobro',
    text: trial > 0 ? 'Mercado Pago nos avisa cuando autorizás tu medio de pago. Durante la prueba no se te cobra.' : 'Mercado Pago nos avisa apenas se procesa el pago.',
  },
  { icon: Mail, title: 'Tu perfil se publica', text: 'Cuando la matrícula está aprobada y tu suscripción activa, tu perfil aparece en el directorio.' },
];

export default function GraciasPage() {
  return (
    <>
      <PageHeader title="¡Gracias por sumarte!" intro="Recibimos tu solicitud. Esto es lo que sigue." tone="text-lime" />
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <ul className="space-y-4">
          {itemsFor(trialMonths()).map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4 rounded-[24px] bg-mint/60 p-5">
              <Icon className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-ink-soft">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/" className="mt-8 inline-flex rounded-full bg-aqua px-7 py-4 font-semibold transition hover:bg-lime">
          Volver al inicio
        </Link>
      </div>
    </>
  );
}
