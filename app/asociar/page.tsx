import type { Metadata } from 'next';
import { OnboardingForm } from '@/components/OnboardingForm';
import { PageHeader } from '@/components/PageHeader';
import { matriculaMode } from '@/lib/matricula';
import { isMockMode, trialMonths } from '@/lib/mercadopago';

const trialText = () => { const t = trialMonths(); return t === 1 ? '1 mes' : `${t} meses`; };

export const metadata: Metadata = { title: 'Suma tu perfil' };
export const dynamic = 'force-dynamic';

export default function AsociarPage() {
  const price = Number(process.env.MEMBERSHIP_PRICE_ARS ?? '0');
  const priceLabel = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(price);

  return (
    <>
      <PageHeader
        title="Suma tu perfil de psicólogo/a"
        intro={trialMonths() > 0 ? `Completá tus datos, sumá tu foto y tus redes y empezá ${trialMonths() === 1 ? 'tu mes' : `tus ${trialText()}`} gratis. Son tres pasos y tarda menos de cinco minutos.` : 'Completá tus datos, sumá tu foto y tus redes y activá tu suscripción. Son tres pasos y tarda menos de cinco minutos.'}
        tone="text-aqua"
      />
      <div className="px-5 py-12 sm:px-8">
        <OnboardingForm priceLabel={priceLabel} mockMode={isMockMode()} trialMonths={trialMonths()} registry={matriculaMode()} />
      </div>
    </>
  );
}
