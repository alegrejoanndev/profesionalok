import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { MpSimulator } from '@/components/MpSimulator';
import { isMockMode } from '@/lib/mercadopago';

export const dynamic = 'force-dynamic';

export default async function SimuladorPage({ searchParams }: { searchParams: Promise<{ pre?: string }> }) {
  if (!isMockMode()) notFound();
  const { pre } = await searchParams;
  if (!pre?.startsWith('mock_')) notFound();

  return (
    <>
      <PageHeader
        title="Simulador de Mercado Pago"
        intro="Estás en modo de prueba (MP_MODE=mock). Acá elegís qué le pasaría a esta suscripción y el sistema reacciona como si Mercado Pago hubiera avisado."
        tone="text-lime"
      />
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <MpSimulator pre={pre} />
      </div>
    </>
  );
}
