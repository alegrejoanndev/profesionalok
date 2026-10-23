'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

type Errors = Record<string, string>;

const field =
  'w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-base outline-none transition focus:border-ink focus:ring-4 focus:ring-aqua/40';

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok'>('idle');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setStatus('sending');
    setErrors({});
    setFormError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus('ok');
        form.reset();
        return;
      }
      setErrors(json.fieldErrors ?? {});
      setFormError(json.error ?? 'No pudimos enviar tu mensaje. Probá de nuevo en unos minutos.');
    } catch {
      setFormError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
    }
    setStatus('idle');
  }

  if (status === 'ok') {
    return (
      <div role="status" className="rounded-[28px] bg-mint p-8">
        <CheckCircle2 className="h-9 w-9" strokeWidth={1.5} />
        <h2 className="mt-4 text-2xl font-semibold">¡Recibimos tu mensaje!</h2>
        <p className="mt-2 max-w-[48ch] text-ink-soft">Te respondemos al email que nos dejaste, generalmente dentro de las 48 horas hábiles.</p>
        <button onClick={() => setStatus('idle')} className="mt-6 rounded-full border border-ink/25 px-6 py-3 font-semibold transition hover:bg-white">
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nombre</span>
            <input name="name" autoComplete="name" required className={field} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'err-name' : undefined} />
          </label>
          {errors.name && <p id="err-name" className="mt-1.5 text-sm font-medium text-[#B4125A]">{errors.name}</p>}
        </div>
        <div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Email</span>
            <input name="email" type="email" autoComplete="email" required className={field} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'err-email' : undefined} />
          </label>
          {errors.email && <p id="err-email" className="mt-1.5 text-sm font-medium text-[#B4125A]">{errors.email}</p>}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">¿Sobre qué querés consultar?</span>
        <select name="topic" defaultValue="consulta" className={field}>
          <option value="consulta">Una consulta general</option>
          <option value="membresia">Mi suscripción o mis pagos</option>
          <option value="soporte">Un problema con el sitio</option>
          <option value="otro">Otro tema</option>
        </select>
      </label>

      <div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Mensaje</span>
          <textarea name="message" rows={6} required className={field} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'err-message' : undefined} />
        </label>
        {errors.message && <p id="err-message" className="mt-1.5 text-sm font-medium text-[#B4125A]">{errors.message}</p>}
      </div>

      {/* Honeypot: invisible para personas, los bots lo completan */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          No completar este campo
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {formError && (
        <p role="alert" className="rounded-2xl bg-pink/15 px-4 py-3 text-sm font-medium">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="inline-flex items-center gap-2 rounded-full bg-aqua px-8 py-4 text-base font-semibold transition hover:bg-lime disabled:opacity-60"
      >
        {status === 'sending' && <Loader2 className="h-5 w-5 animate-spin" />}
        {status === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
      </button>
    </form>
  );
}
