'use client';

import Link from 'next/link';
import { useState } from 'react';

const ACTIONS = [
  { action: 'authorize', label: '1. Autorizar la suscripción', hint: 'El profesional carga su tarjeta. Si tiene mes gratis, el perfil se activa ahora (y se publica si el título está aprobado).', style: 'bg-aqua hover:bg-lime' },
  { action: 'approve', label: '2. Cobrar (terminó la prueba)', hint: 'Simula un cobro aprobado. Sin mes gratis, es lo que activa el perfil.', style: 'bg-lime hover:bg-aqua' },
  { action: 'reject', label: 'Rechazar un cobro', hint: 'Baja lógica inmediata + mail con link para regularizar.', style: 'bg-pink hover:bg-lavender' },
  { action: 'reject_final', label: 'Rechazar el último reintento', hint: 'Se cancela la suscripción + mail de cancelación.', style: 'bg-lavender hover:bg-pink' },
  { action: 'cancel', label: 'Cancelar desde Mercado Pago', hint: 'El profesional se da de baja por su cuenta (también durante la prueba: no se cobra nada).', style: 'bg-mint hover:bg-lime' },
];

export function MpSimulator({ pre }: { pre: string }) {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(action: string, label: string) {
    setBusy(true);
    const res = await fetch('/api/dev/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pre, action }),
    });
    const json = await res.json().catch(() => ({}));
    setLog((l) => [`${label} → ${res.ok ? (json.results as string[]).join(', ') : json.error}`, ...l]);
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <button key={a.action} disabled={busy} onClick={() => run(a.action, a.label)} className={`rounded-[24px] p-5 text-left transition disabled:opacity-60 ${a.style}`}>
            <span className="block font-semibold">{a.label}</span>
            <span className="mt-1 block text-sm">{a.hint}</span>
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <ul role="log" aria-live="polite" className="space-y-1 rounded-2xl bg-ink p-5 font-mono text-sm text-white">
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/asociar/gracias" className="rounded-full border border-ink/25 px-5 py-2.5 transition hover:bg-mint">Ir a la página de gracias</Link>
        <Link href="/profesionales" className="rounded-full border border-ink/25 px-5 py-2.5 transition hover:bg-mint">Ver el directorio</Link>
        {/* <a> y no <Link>: el panel pide contraseña y Next intentaría precargarlo */}
        <a href="/admin" className="rounded-full border border-ink/25 px-5 py-2.5 transition hover:bg-mint">Abrir el panel interno</a>
      </div>
    </div>
  );
}
