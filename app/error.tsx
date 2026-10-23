'use client';

import { useEffect } from 'react';

/** Pantalla de error amigable (en lugar de la pantalla técnica de Next). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
      <h1 className="font-display text-5xl tracking-wide">Algo no salió como esperábamos</h1>
      <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-ink-soft">
        No pudimos cargar esta página. Probá de nuevo en unos segundos.
      </p>
      <p className="mt-3 max-w-[56ch] text-sm text-ink-soft">
        Si estás ejecutando el proyecto en tu computadora, revisá que la base de datos esté encendida
        (<code>docker compose up -d</code>) o dejá <code>DATABASE_URL=&quot;&quot;</code> en el archivo <code>.env</code> para usar el modo demo.
      </p>
      <button onClick={reset} className="mt-8 rounded-full bg-aqua px-7 py-4 font-semibold transition hover:bg-lime">
        Reintentar
      </button>
    </div>
  );
}
