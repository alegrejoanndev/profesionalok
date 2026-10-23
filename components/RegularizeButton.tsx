'use client';

import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

export function RegularizeButton({ token, label }: { token: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/regularizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.initPoint) {
        window.location.href = json.initPoint;
        return;
      }
      setError(json.error ?? 'No pudimos continuar. Probá de nuevo en unos minutos.');
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
    }
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full bg-pink px-8 py-4 text-base font-semibold transition hover:bg-lavender disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
        {loading ? 'Preparando tu pago…' : label}
      </button>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-pink/15 px-4 py-3 text-sm font-medium">{error}</p>}
    </div>
  );
}
