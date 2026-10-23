import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { professionals } from '@/db/schema';
import { PageHeader } from '@/components/PageHeader';
import { RegularizeButton } from '@/components/RegularizeButton';
import { getDb, hasDatabase } from '@/lib/db';

export const metadata: Metadata = { title: 'Regularizar mi suscripción', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function RegularizarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [prof] =
    hasDatabase() && /^[a-f0-9]{64}$/.test(token)
      ? await getDb()
          .select({ firstName: professionals.firstName, status: professionals.status })
          .from(professionals)
          .where(
            and(
              eq(professionals.regularizeToken, token),
              gt(professionals.regularizeTokenExpiresAt, new Date()),
              isNull(professionals.deletedAt),
            ),
          )
          .limit(1)
      : [];

  if (!prof) {
    return (
      <>
        <PageHeader title="Este enlace ya no es válido" intro="Puede que haya vencido o que tu suscripción ya esté regularizada." />
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
          <p className="max-w-[56ch] text-ink-soft">
            Si tu perfil sigue sin aparecer en el directorio, escribinos y lo resolvemos.
          </p>
          <Link href="/contacto" className="mt-6 inline-flex rounded-full bg-aqua px-7 py-4 font-semibold transition hover:bg-lime">
            Ir a Contacto
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Hola ${prof.firstName}, regularicemos tu suscripción`} intro="No pudimos cobrar tu suscripción y por eso tu perfil dejó de estar visible." tone="text-pink" />
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <ul className="mb-8 space-y-3 text-ink-soft">
          <li>Te llevamos a Mercado Pago para que cargues un medio de pago.</li>
          <li>Apenas se acredite el cobro, tu perfil vuelve a publicarse automáticamente.</li>
          <li>Si ya tenías una suscripción anterior, la reemplazamos por esta: no se cobra dos veces.</li>
        </ul>
        <RegularizeButton token={token} label="Actualizar mi medio de pago" />
      </div>
    </>
  );
}
