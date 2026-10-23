import type { Metadata } from 'next';
import { OnboardingForm } from '@/components/OnboardingForm';
import { PageHeader } from '@/components/PageHeader';
import { matriculaMode } from '@/lib/matricula';
import { isMockMode, trialMonths } from '@/lib/mercadopago';

export const metadata: Metadata = { title: 'Suma tu perfil' };
export const dynamic = 'force-dynamic';

export default function AsociarPage() {
  const price = Number(process.env.MEMBERSHIP_PRICE_ARS ?? '0');
  const priceLabel = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(price);

  return (
    <>
      <PageHeader
        title="Suma tu perfil al directorio"
        intro={trialMonths() > 0 ? 'Completá tus datos, subí tu título y empezá tu mes gratis. Son tres pasos y tarda menos de cinco minutos.' : 'Completá tus datos, subí tu título y activá tu suscripción. Son tres pasos y tarda menos de cinco minutos.'}
        tone="text-aqua"
      />
      <div className="px-5 py-12 sm:px-8">
        <OnboardingForm priceLabel={priceLabel} mockMode={isMockMode()} trialMonths={trialMonths()} matriculaAuto={matriculaMode() !== 'off'} />
      </div>
    </>
  );
}
