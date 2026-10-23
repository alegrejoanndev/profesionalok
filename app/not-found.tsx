import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';

export default function NotFound() {
  return (
    <>
      <PageHeader title="No encontramos esta página" intro="Puede que el enlace esté mal escrito o que la página ya no exista." />
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <Link href="/" className="inline-flex rounded-full bg-aqua px-7 py-4 font-semibold transition hover:bg-lime">
          Volver al inicio
        </Link>
      </div>
    </>
  );
}
