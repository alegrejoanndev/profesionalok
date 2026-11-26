'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, CreditCard, Loader2, ShieldAlert, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { SocialIcon } from './SocialIcons';
import { Seal } from './Seal';
import {
  AGE_GROUPS, LOCALITY_SUGGESTIONS, MODALITIES, OBRAS_SOCIALES, ageLabel, approachesFor, cleanCustomOption, modalityLabel, specialtiesFor,
} from '@/lib/catalog';
import { DEFAULT_PROFESSION, getProfession } from '@/lib/professions';
import { SOCIALS } from '@/lib/socials';
import { FILE_LIMITS, PROVINCES, onboardingSchema } from '@/lib/validation';

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  profession: string;
  licenses: Record<string, string>;
  licenseProvince: string;
  city: string;
  province: string;
  bio: string;
  dni: string;
  specialties: string[];
  corrientes: string[];
  ageGroups: string[];
  modalidad: string;
  obrasSociales: string[];
};
type Errors = Record<string, string>;

const EMPTY: Values = {
  firstName: '', lastName: '', email: '', phone: '', profession: DEFAULT_PROFESSION,
  licenses: {}, licenseProvince: 'Santa Fe', city: '', province: 'Santa Fe', bio: '', dni: '', whatsapp: '', instagram: '', facebook: '', linkedin: '',
  specialties: [], corrientes: [], ageGroups: [], modalidad: '', obrasSociales: [],
};

const STEPS = ['Tus datos', 'Foto y redes', 'Suscripción'] as const;

/** Campos del paso 2: sus errores se muestran ahí y no frenan el paso 1. */
const STEP2_FIELDS = ['whatsapp', 'instagram', 'facebook', 'linkedin'];

const input =
  'w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-base outline-none transition focus:border-ink focus:ring-4 focus:ring-aqua/40 aria-[invalid=true]:border-[#B4125A]';
const errText = 'mt-1.5 block text-sm font-medium text-[#B4125A]';
const chipBase =
  'inline-block cursor-pointer select-none rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-medium transition duration-200 hover:border-ink/40 peer-checked:border-ink peer-checked:bg-lime peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Recorta al centro y reduce a 800×800 antes de subir: la foto de un celular puede pesar 8 MB. */
async function squareResize(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(800, side);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return new File([blob], 'perfil.jpg', { type: 'image/jpeg' });
}

function Field({ name, label, hint, error, children }: { name: string; label: React.ReactNode; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{label}</span>
        {children}
      </label>
      {hint && !error && <p className="mt-1.5 text-sm text-ink-soft">{hint}</p>}
      {error && <p id={`err-${name}`} className={errText}>{error}</p>}
    </div>
  );
}

/**
 * Grupo de opciones tipo "chip": varias a la vez (checkbox) o una sola (radio).
 * Con `otherLabel` se puede agregar una opción propia escrita a mano (queda como un chip más, que se puede destildar).
 */
function ChipGroup({
  legend, hint, error, options, selected, onToggle, single = false, name, otherLabel, otherPlaceholder,
}: {
  legend: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string; hint?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  single?: boolean;
  name: string;
  otherLabel?: string;
  otherPlaceholder?: string;
}) {
  const [other, setOther] = useState('');
  const [otherError, setOtherError] = useState('');
  // Lo elegido que no está en la lista son las opciones agregadas a mano
  const custom = selected.filter((x) => !options.some((o) => o.value === x));

  function addOther() {
    if (!other.trim()) return;
    const clean = cleanCustomOption(other);
    if (!clean) return setOtherError('Usá solo letras y números, de 2 a 60 caracteres.');
    const known = options.find((o) => o.value.toLowerCase() === clean.toLowerCase())?.value ?? selected.find((x) => x.toLowerCase() === clean.toLowerCase());
    if (known) {
      if (!selected.includes(known)) onToggle(known);
    } else onToggle(clean);
    setOther('');
    setOtherError('');
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {[...options, ...custom.map((c) => ({ value: c, label: c, hint: 'Agregada por vos' }))].map((o) => (
          <label key={o.value}>
            <input
              type={single ? 'radio' : 'checkbox'}
              name={single ? name : undefined}
              checked={selected.includes(o.value)}
              onChange={() => onToggle(o.value)}
              className="peer sr-only"
            />
            <span className={chipBase} title={o.hint}>{o.label}</span>
          </label>
        ))}
      </div>
      {otherLabel && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm outline-none transition focus:border-ink focus:ring-4 focus:ring-aqua/40 sm:max-w-xs"
              value={other}
              onChange={(e) => { setOther(e.target.value); setOtherError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOther(); } }}
              placeholder={otherPlaceholder ?? 'Escribí otra'}
              aria-label={otherLabel}
              maxLength={60}
            />
            <button type="button" onClick={addOther} className="rounded-full bg-aqua px-5 py-2 text-sm font-semibold transition hover:bg-lime">
              {otherLabel}
            </button>
          </div>
          {otherError && <p className={errText}>{otherError}</p>}
        </div>
      )}
      {hint && !error && <p className="mt-1.5 text-sm text-ink-soft">{hint}</p>}
      {error && <p id={`err-${name}`} className={errText}>{error}</p>}
    </fieldset>
  );
}

/** Obras sociales: lista con buscador para tildar las que atendés, más un campo para agregar otras. */
function ObrasSocialesPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const [other, setOther] = useState('');
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const shown = OBRAS_SOCIALES.filter((o) => norm(o).includes(norm(q.trim())));
  const custom = value.filter((o) => !OBRAS_SOCIALES.includes(o));
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);

  function addOther() {
    const name = other.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (name.length < 2) return;
    if (!value.some((x) => norm(x) === norm(name))) onChange([...value, name]);
    setOther('');
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Obras sociales y prepagas que atendés (opcional)</legend>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar obra social…"
        aria-label="Buscar obra social"
        className={input}
      />
      <ul className="mt-2 grid max-h-56 gap-1 overflow-y-auto rounded-2xl border border-ink/15 bg-white p-2 sm:grid-cols-2">
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">No está en la lista: agregala abajo.</li>}
        {shown.map((o) => (
          <li key={o}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition hover:bg-mint/60">
              <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} className="h-4 w-4 shrink-0 accent-ink" />
              {o}
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOther(); } }}
          placeholder="Otra obra social o prepaga"
          aria-label="Agregar otra obra social"
          className={input}
        />
        <button type="button" onClick={addOther} className="shrink-0 rounded-2xl border border-ink/20 px-5 font-semibold transition hover:bg-mint">
          Agregar
        </button>
      </div>

      {custom.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Otras obras sociales agregadas">
          {custom.map((o) => (
            <li key={o} className="inline-flex items-center gap-1 rounded-full bg-lime py-1 pl-4 pr-1.5 text-sm font-medium">
              {o}
              <button type="button" onClick={() => toggle(o)} aria-label={`Quitar ${o}`} className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-ink/10">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-ink-soft">{value.length === 0 ? 'Si no tildás ninguna, tu perfil no muestra obras sociales.' : `${value.length} seleccionada${value.length === 1 ? '' : 's'}.`}</p>
    </fieldset>
  );
}

const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};

/** Estado del cartel "Antes de continuar" (aviso del padrón + verificación previa al pago). */
type Gate =
  | { phase: 'closed' }
  | { phase: 'notice' }
  | { phase: 'checking' }
  | { phase: 'result'; status: string; blocking: boolean; message: string }
  | { phase: 'error'; message: string };

/** Los datos que influyen en la verificación: si cambian, hay que volver a verificar. */
const gateKey = (v: Values) => JSON.stringify([v.firstName, v.lastName, v.profession, v.licenses, v.licenseProvince, v.dni]);

export function OnboardingForm({
  priceLabel,
  mockMode,
  trialMonths,
  registry,
}: {
  priceLabel: string;
  mockMode: boolean;
  trialMonths: number;
  /** Con qué se verifica la matrícula: padrón del Colegio de Psicólogos de Santa Fe (cpsf), REFEPS, simulador o nada. */
  registry: 'cpsf' | 'refeps' | 'mock' | 'off';
}) {
  const router = useRouter();
  const uid = useId();
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [gate, setGate] = useState<Gate>({ phase: 'closed' });
  const [mounted, setMounted] = useState(false); // las sugerencias de ciudad se agregan después de hidratar
  useEffect(() => setMounted(true), []);
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const profession = getProfession(v.profession);
  // La verificación automática pide DNI solo con REFEPS; con el Colegio de Psicólogos se usa nombre + matrícula.
  const needsDni = registry === 'refeps' || registry === 'mock';
  // Con el Colegio de Psicólogos de Santa Fe solo se puede consultar a quienes tienen matrícula de esa provincia:
  // las de otras provincias siguen, y las verifica el equipo antes de publicar.
  const matriculaAuto = registry === 'cpsf' ? v.licenseProvince === 'Santa Fe' : registry !== 'off';
  const specialtyOptions = specialtiesFor(v.profession);
  const approachOptions = approachesFor(v.profession);
  const trialLabel = trialMonths === 1 ? 'mes' : `${trialMonths} meses`;
  const firstCharge = addMonths(new Date(), trialMonths).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Al cambiar de paso, llevar el foco al título (accesibilidad) y subir al inicio del formulario
  useEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  // El cartel usa <dialog>: el navegador se ocupa del foco y de cerrar con Escape
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (gate.phase !== 'closed' && !d.open) d.showModal();
    if (gate.phase === 'closed' && d.open) d.close();
  }, [gate.phase]);

  const clearError = (k: string) =>
    setErrors((e) => {
      if (!e[k]) return e;
      const { [k]: _removed, ...rest } = e;
      void _removed;
      return rest;
    });

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    clearError(k as string);
  };
  const toggleIn = (k: 'specialties' | 'corrientes' | 'ageGroups', value: string) =>
    set(k, v[k].includes(value) ? v[k].filter((x) => x !== value) : [...v[k], value]);
  const setLicense = (type: string, val: string) => {
    setV((p) => ({ ...p, licenses: { ...p.licenses, [type]: val } }));
    clearError(`licenses.${type}`);
  };

  function validateStep1(): boolean {
    const r = onboardingSchema.safeParse({ ...v, acceptTerms: true });
    const next: Errors = {};
    if (!r.success) for (const i of r.error.issues) if (!STEP2_FIELDS.includes(String(i.path[0]))) next[i.path.join('.')] ??= i.message;
    if (needsDni && !v.dni.trim()) next.dni ??= 'Ingresá tu DNI o tu CUIT para verificar tu matrícula';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // Llevar la vista al primer error para que no quede escondido más abajo
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], [id^="err-"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    return Object.keys(next).length === 0;
  }

  function validateStep2(): boolean {
    const next: Errors = {};
    // La foto es opcional: si falta, el perfil muestra el logo. Las redes también son opcionales, pero si se completan deben ser válidas.
    const r = onboardingSchema.safeParse({ ...v, acceptTerms: true });
    if (!r.success) for (const i of r.error.issues) if (STEP2_FIELDS.includes(String(i.path[0]))) next[i.path.join('.')] ??= i.message;
    if (!accept) next.acceptTerms = 'Tenés que aceptar los términos para continuar';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], [id^="err-"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    return Object.keys(next).length === 0;
  }

  const next = () => {
    if (step === 0) {
      if (!validateStep1()) return;
      // Si ya se verificó con estos mismos datos, no se vuelve a preguntar
      if (verifiedKey === gateKey(v)) return goToStep(1);
      setGate({ phase: 'notice' });
      return;
    }
    if (step === 1 && !validateStep2()) return;
    goToStep(step + 1);
  };

  const goToStep = (n: number) => {
    setErrors({});
    setStep(n);
  };

  /** "Entendido": consulta el padrón antes de pedir documentación o dinero. */
  async function verifyAgainstRegistry() {
    if (!matriculaAuto) {
      // Sin validación automática: la verificación la hace una persona antes de publicar
      setGate({ phase: 'closed' });
      goToStep(1);
      return;
    }
    setGate({ phase: 'checking' });
    try {
      const res = await fetch('/api/matricula/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 400 && json.fieldErrors) {
        setErrors(json.fieldErrors);
        setGate({ phase: 'closed' });
        return;
      }
      if (!res.ok) {
        setGate({ phase: 'error', message: json.error ?? 'No pudimos verificar tu matrícula. Probá de nuevo en unos minutos.' });
        return;
      }
      if (!json.blocking) setVerifiedKey(gateKey(v));
      setGate({ phase: 'result', status: json.status, blocking: !!json.blocking, message: json.message });
    } catch {
      setGate({ phase: 'error', message: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.' });
    }
  }

  /** "Darme de baja": no se guardó nada, así que alcanza con salir. */
  const dropOut = () => {
    setGate({ phase: 'closed' });
    router.push('/');
  };

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErrors((p) => ({ ...p, photo: 'La foto tiene que ser una imagen JPG, PNG o WebP' }));
    try {
      const small = await squareResize(f);
      setPhoto(small);
      setPhotoPreview(URL.createObjectURL(small));
      clearError('photo');
    } catch {
      setErrors((p) => ({ ...p, photo: 'No pudimos leer esa imagen. Probá con otra.' }));
    }
  }

  async function pay() {
    setSubmitting(true);
    setServerError('');
    const fd = new FormData();
    fd.set('data', JSON.stringify({ ...v, acceptTerms: accept }));
    if (photo) fd.set('photo', photo);
    try {
      const res = await fetch('/api/onboarding', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.initPoint) {
        window.location.href = json.initPoint;
        return;
      }
      if (json.matricula?.blocking) {
        // El servidor verifica de nuevo antes de cobrar: si no coincide, no se llega al pago
        setVerifiedKey(null);
        setStep(0);
        setGate({ phase: 'result', status: json.matricula.status, blocking: true, message: json.matricula.message });
      } else if (json.fieldErrors) {
        setErrors(json.fieldErrors);
        setStep(0);
      }
      setServerError(json.error ?? 'No pudimos continuar. Probá de nuevo en unos minutos.');
    } catch {
      setServerError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
    }
    setSubmitting(false);
  }

  const aria = (name: string) => ({ 'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `err-${name}` : undefined });

  return (
    <div className="mx-auto max-w-3xl">
      {/* Pasos: es una secuencia real, por eso van numerados */}
      <ol className="mb-10 grid grid-cols-3 gap-2" aria-label="Pasos del registro">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined} className="flex flex-col items-center gap-2 text-center">
            <span className="relative grid h-12 w-12 place-items-center font-display text-2xl">
              <Seal className="absolute inset-0 h-full w-full transition-colors duration-300" fill={i <= step ? '#04E1CD' : '#E4EEEC'} />
              <span className="relative">{i + 1}</span>
            </span>
            <span className={`text-sm ${i === step ? 'font-semibold' : 'text-ink-soft'}`}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-[32px] border border-ink/10 bg-white p-6 sm:p-9">
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-2xl font-semibold outline-none">
          {step === 0 && 'Contanos quién sos'}
          {step === 1 && 'Sumá tu foto y tus redes'}
          {step === 2 && (trialMonths > 0 ? `Empezá tus ${trialLabel} gratis` : 'Activá tu suscripción mensual')}
        </h2>

        {/* ───── Paso 1 ───── */}
        {step === 0 && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field error={errors.firstName} name="firstName" label="Nombre">
                <input className={input} autoComplete="given-name" value={v.firstName} onChange={(e) => set('firstName', e.target.value)} {...aria('firstName')} />
              </Field>
              <Field error={errors.lastName} name="lastName" label="Apellido">
                <input className={input} autoComplete="family-name" value={v.lastName} onChange={(e) => set('lastName', e.target.value)} {...aria('lastName')} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field error={errors.email} name="email" label="Email" hint="Acá te avisamos si hay un problema con el cobro.">
                <input className={input} type="email" autoComplete="email" value={v.email} onChange={(e) => set('email', e.target.value)} {...aria('email')} />
              </Field>
              <Field error={errors.phone} name="phone" label="Celular de contacto (WhatsApp)" hint="Con código de área, sin 0 ni 15. Ej: 3482 440552">
                <input className={input} type="tel" inputMode="tel" autoComplete="tel-national" value={v.phone} onChange={(e) => set('phone', e.target.value)} {...aria('phone')} />
              </Field>
            </div>

            {/* Datos de matrícula */}
            {profession && (
              <div className="space-y-5 rounded-[24px] bg-mint/60 p-5">
                <p className="text-sm font-medium">Datos de tu matrícula de psicología</p>
                <div className="grid gap-5 sm:grid-cols-2">
                  {profession.licenses.map((lic) => (
                    <Field key={lic.type} error={errors[`licenses.${lic.type}`]} name={`licenses.${lic.type}`} label={`${lic.label}${lic.required ? '' : ' (opcional)'}`} hint={lic.hint}>
                      <input
                        className={input}
                        value={v.licenses[lic.type] ?? ''}
                        onChange={(e) => setLicense(lic.type, e.target.value)}
                        {...aria(`licenses.${lic.type}`)}
                      />
                    </Field>
                  ))}
                  <Field error={errors.licenseProvince} name="licenseProvince" label="Provincia que emitió la matrícula">
                    <select className={input} value={v.licenseProvince} onChange={(e) => set('licenseProvince', e.target.value)} {...aria('licenseProvince')}>
                      {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  {needsDni && (
                    <Field
                      error={errors.dni}
                      name="dni"
                      label="DNI o CUIT"
                      hint="Solo números, sin puntos ni guiones. Lo usamos únicamente para confirmar tu matrícula en el padrón oficial: no se guarda ni se muestra."
                    >
                      <input className={input} inputMode="numeric" autoComplete="off" placeholder="DNI (8 números) o CUIT (11 números)" value={v.dni} onChange={(e) => set('dni', e.target.value)} {...aria('dni')} />
                    </Field>
                  )}
                </div>
                <p className="flex items-start gap-2 text-sm text-ink-soft">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  {matriculaAuto
                    ? registry === 'cpsf'
                      ? 'Antes de seguir, comprobamos tu matrícula en el padrón del Colegio de Psicólogos de la Provincia de Santa Fe.'
                      : 'Antes de seguir, comprobamos tu matrícula contra el padrón oficial.'
                    : 'Tu matrícula es de otra provincia: no la podemos consultar automáticamente. Podés continuar y una persona del equipo la verifica antes de publicar tu perfil.'}
                </p>
              </div>
            )}

            {/* Cómo y a quién atiende */}
            {profession && (
              <div className="space-y-6 rounded-[24px] border border-ink/10 p-5">
                <p className="text-sm font-semibold">Cómo atendés</p>

                {(
                  <ChipGroup
                    name="specialties"
                    legend="Especialidades (podés elegir más de una)"
                    hint="¿No está la tuya? Agregala vos con el botón."
                    otherLabel="Agregar otra especialidad"
                    otherPlaceholder="Ej: Psicogerontología"
                    error={errors.specialties}
                    options={specialtyOptions.map((s) => ({ value: s, label: s }))}
                    selected={v.specialties}
                    onToggle={(s) => toggleIn('specialties', s)}
                  />
                )}

                {(
                  <ChipGroup
                    name="corrientes"
                    legend="Corriente u orientación (podés elegir más de una)"
                    hint="¿No está la tuya? Agregala vos con el botón."
                    otherLabel="Agregar otras"
                    otherPlaceholder="Ej: Terapia de juego"
                    error={errors.corrientes}
                    options={approachOptions.map((s) => ({ value: s, label: s }))}
                    selected={v.corrientes}
                    onToggle={(s) => toggleIn('corrientes', s)}
                  />
                )}

                <ChipGroup
                  name="ageGroups"
                  legend="Rango etario que atendés (elegí uno o más)"
                  error={errors.ageGroups}
                  options={AGE_GROUPS.map((a) => ({ value: a.value, label: a.label, hint: a.hint }))}
                  selected={v.ageGroups}
                  onToggle={(s) => toggleIn('ageGroups', s)}
                />

                <ChipGroup
                  name={`${uid}-modalidad`}
                  legend="Modalidad de atención"
                  error={errors.modalidad}
                  single
                  options={MODALITIES.map((m) => ({ value: m.value, label: m.label }))}
                  selected={v.modalidad ? [v.modalidad] : []}
                  onToggle={(m) => set('modalidad', m)}
                />

                <ObrasSocialesPicker value={v.obrasSociales} onChange={(o) => set('obrasSociales', o)} />
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field error={errors.city} name="city" label="Ciudad o localidad donde atendés">
                <input className={input} autoComplete="address-level2" list={mounted ? `${uid}-ciudades` : undefined} value={v.city} onChange={(e) => set('city', e.target.value)} {...aria('city')} />
                {mounted && (
                  <datalist id={`${uid}-ciudades`}>
                    {LOCALITY_SUGGESTIONS.map((l) => <option key={l} value={l} />)}
                  </datalist>
                )}
              </Field>
              <Field error={errors.province} name="province" label="Provincia">
                <select className={input} value={v.province} onChange={(e) => set('province', e.target.value)} {...aria('province')}>
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            <Field error={errors.bio} name="bio" label="Presentación (opcional)" hint={`${v.bio.length}/600 caracteres`}>
              <textarea className={input} rows={4} value={v.bio} onChange={(e) => set('bio', e.target.value)} {...aria('bio')} />
            </Field>
          </div>
        )}

        {/* ───── Paso 2 ───── */}
        {step === 1 && (
          <div className="mt-6 space-y-8">
            <div>
              <p className="mb-3 text-sm font-medium">Foto de perfil <span className="font-normal text-ink-soft">(opcional)</span></p>
              <div className="flex flex-wrap items-center gap-6">
                <Avatar name={`${v.firstName} ${v.lastName}`.trim() || 'Tu foto'} photoUrl={photoPreview} tone="lavender" className="h-28 w-28" />
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-aqua px-6 py-3 font-semibold transition hover:bg-lime focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2">
                      <Upload className="h-5 w-5" />
                      {photo ? 'Cambiar foto' : 'Elegir foto'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPhoto} />
                    </label>
                    {photo && (
                      <button
                        type="button"
                        onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                        className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-3 font-semibold transition hover:bg-pink/20"
                      >
                        <Trash2 className="h-4 w-4" /> Quitar
                      </button>
                    )}
                  </div>
                  <p className="mt-2 max-w-[44ch] text-sm text-ink-soft">
                    Se muestra redonda en tu perfil: una foto tuya, de frente y con buena luz. Si no subís ninguna, mostramos el logo de ProfesionalesOk.
                  </p>
                </div>
              </div>
              {errors.photo && <span className={errText}>{errors.photo}</span>}
            </div>

            <div>
              <p className="text-sm font-medium">Redes y contacto <span className="font-normal text-ink-soft">(opcional)</span></p>
              <p className="mt-1 max-w-[60ch] text-sm text-ink-soft">
                Se muestran en tu perfil para que te encuentren y te escriban. Podés escribir el enlace o solo tu usuario.
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Field
                  error={errors.whatsapp}
                  name="whatsapp"
                  label="WhatsApp"
                  hint="Si lo dejás vacío, usamos el teléfono que cargaste."
                >
                  <input className={input} inputMode="tel" autoComplete="off" placeholder="3482 440552" value={v.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} {...aria('whatsapp')} />
                </Field>
                {SOCIALS.map((s) => (
                  <Field
                    key={s.kind}
                    error={errors[s.kind]}
                    name={s.kind}
                    label={<span className="inline-flex items-center gap-2"><SocialIcon kind={s.kind} />{s.label}</span>}
                    hint={s.hint}
                  >
                    <input className={input} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={s.placeholder} value={v[s.kind]} onChange={(e) => set(s.kind, e.target.value)} {...aria(s.kind)} />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={accept} onChange={(e) => { setAccept(e.target.checked); clearError('acceptTerms'); }} className="mt-1 h-5 w-5 shrink-0 accent-ink" aria-invalid={!!errors.acceptTerms} />
                <span className="text-sm leading-relaxed">
                  Declaro que mis datos son verdaderos y que mi matrícula está vigente. Acepto los{' '}
                  <Link href="/terminos" target="_blank" className="font-semibold underline underline-offset-4">términos y condiciones</Link>{' '}
                  y el tratamiento de mis datos personales.
                </span>
              </label>
              {errors.acceptTerms && <span className={errText}>{errors.acceptTerms}</span>}
            </div>
          </div>
        )}

        {/* ───── Paso 3 ───── */}
        {step === 2 && (
          <div className="mt-6 space-y-6">
            {mockMode && (
              <p role="note" className="rounded-2xl bg-lime px-5 py-3 text-sm font-medium">
                Modo de prueba: no se cobra nada. Te llevamos a un simulador de Mercado Pago.
              </p>
            )}

            <div className="flex items-center gap-5 rounded-[24px] bg-mint p-5">
              <Avatar name={`${v.firstName} ${v.lastName}`} photoUrl={photoPreview} tone="aqua" className="h-20 w-20" />
              <div className="min-w-0">
                <p className="text-lg font-semibold">{v.firstName} {v.lastName}</p>
                <p className="text-sm text-ink-soft">{profession?.label} · {v.city}, {v.province}</p>
                <p className="text-sm text-ink-soft">{modalityLabel(v.modalidad)} · {v.ageGroups.map(ageLabel).join(', ')}</p>
                <p className="truncate text-sm text-ink-soft">{v.email}</p>
              </div>
            </div>

            <p className="flex items-center gap-2 rounded-2xl bg-lime px-5 py-3 text-sm font-medium">
              <BadgeCheck className="h-5 w-5 shrink-0" />
              {matriculaAuto ? 'Tu matrícula ya fue verificada contra el padrón oficial.' : 'Tu matrícula la verifica una persona del equipo antes de publicar tu perfil.'}
            </p>

            <div className="rounded-[24px] border border-ink/15 p-5">
              {trialMonths > 0 ? (
                <>
                  <span className="inline-block rounded-full bg-lime px-3 py-1 text-sm font-semibold">
                    {trialMonths === 1 ? '1 mes gratis' : `${trialMonths} meses gratis`} · por única vez
                  </span>
                  <div className="mt-4 flex items-baseline justify-between gap-4">
                    <p className="font-semibold">Hoy pagás</p>
                    <p className="text-3xl font-semibold">$0</p>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-4 text-ink-soft">
                    <p>Primer cobro: {firstCharge}</p>
                    <p className="font-semibold text-ink">{priceLabel} / mes</p>
                  </div>
                </>
              ) : (
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-semibold">Suscripción mensual</p>
                  <p className="text-2xl font-semibold">{priceLabel}<span className="text-sm font-normal text-ink-soft"> / mes</span></p>
                </div>
              )}
              <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                {trialMonths > 0 ? (
                  <>
                    <li>Cargás tu medio de pago en Mercado Pago, pero durante la prueba no se te cobra.</li>
                    <li>La prueba gratis se otorga una sola vez por profesional.</li>
                    <li>Si cancelás antes del {firstCharge}, no se te cobra nada.</li>
                    <li>Después, el débito es automático cada mes.</li>
                  </>
                ) : (
                  <>
                    <li>Pagás con Mercado Pago, con débito automático cada mes.</li>
                    <li>Podés cancelar cuando quieras desde tu cuenta de Mercado Pago.</li>
                  </>
                )}
                <li>Tu perfil se publica cuando se completa la verificación de tu matrícula.</li>
                <li>Si un cobro falla —por retraso o fondos insuficientes— tu perfil se suspende y te avisamos por email para regularizarlo.</li>
              </ul>
            </div>

            {serverError && <p role="alert" className="rounded-2xl bg-pink/15 px-5 py-4 text-sm font-medium">{serverError}</p>}

            <button
              type="button"
              onClick={pay}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-pink px-8 py-4 text-base font-semibold transition hover:bg-lavender disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
              {submitting ? 'Preparando tu pago…' : trialMonths > 0 ? 'Empezá tu suscripción gratis hoy!' : 'Suscribirme con Mercado Pago'}
            </button>
          </div>
        )}

        {/* Navegación */}
        <div className="mt-9 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => { setServerError(''); setStep((s) => s - 1); }} disabled={submitting} className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3 font-semibold transition hover:bg-mint">
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
          ) : <span />}
          {step < 2 && (
            <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-full bg-aqua px-7 py-3.5 font-semibold transition hover:bg-lime">
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ───── Cartel "Antes de continuar": aviso del padrón + verificación previa al pago ───── */}
      <dialog
        ref={dialogRef}
        aria-labelledby={`${uid}-gate-title`}
        onCancel={(e) => { if (gate.phase === 'checking') e.preventDefault(); else setGate({ phase: 'closed' }); }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[28px] border border-ink/10 bg-white p-0 text-ink shadow-[0_30px_80px_-30px_rgba(8,34,32,.6)] backdrop:bg-ink/50"
      >
        <div className="p-6 sm:p-8">
          {gate.phase === 'notice' && (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                <ShieldAlert className="h-5 w-5" /> Aviso importante
              </p>
              <h3 id={`${uid}-gate-title`} className="mt-2 text-2xl font-semibold">Antes de continuar</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">
                {matriculaAuto ? (
                  registry === 'cpsf' ? (
                    <>Vamos a verificar tus datos <strong className="text-ink">CONTRA el padrón oficial</strong> del Colegio de Psicólogos de la Provincia de Santa Fe.</>
                  ) : (
                    <>Vamos a verificar tus datos <strong className="text-ink">CONTRA el padrón oficial</strong> de profesionales de la salud.</>
                  )
                ) : (
                  <>Tu matrícula es de otra provincia, así que una persona del equipo va a verificar tus datos <strong className="text-ink">CONTRA el padrón oficial</strong> de tu colegio antes de publicar tu perfil.</>
                )}
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed">
                <li className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />Tienen que coincidir tu nombre y apellido y tu número de matrícula.</li>
                {matriculaAuto && <li className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />Si no figura o no coincide, no vas a poder avanzar al pago: podés corregir tus datos o darte de baja.</li>}
                {needsDni && <li className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />Tu DNI o CUIT se usa solo para esta consulta: no se guarda.</li>}
              </ul>
              <div className="mt-7 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={dropOut} className="rounded-full border border-ink/20 px-6 py-3 font-semibold transition hover:bg-pink/20">
                  Darme de baja
                </button>
                <button type="button" onClick={verifyAgainstRegistry} autoFocus className="rounded-full bg-aqua px-6 py-3 font-semibold transition hover:bg-lime">
                  {matriculaAuto ? 'Entendido, verificar' : 'Entendido, continuar'}
                </button>
              </div>
            </>
          )}

          {gate.phase === 'checking' && (
            <div role="status" aria-live="polite" className="py-6 text-center">
              <Loader2 className="mx-auto h-9 w-9 animate-spin" />
              <h3 id={`${uid}-gate-title`} className="mt-4 text-xl font-semibold">Consultando el padrón…</h3>
              <p className="mt-2 text-sm text-ink-soft">Comprobamos tu matrícula. Tarda unos segundos.</p>
            </div>
          )}

          {gate.phase === 'result' && (
            <>
              <span className={`grid h-14 w-14 place-items-center rounded-full ${gate.blocking ? 'bg-pink/25' : gate.status === 'VERIFIED' ? 'bg-aqua' : 'bg-lime'}`}>
                {gate.blocking ? <ShieldAlert className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
              </span>
              <h3 id={`${uid}-gate-title`} className="mt-4 text-2xl font-semibold">
                {gate.blocking ? 'No pudimos verificar tu matrícula' : gate.status === 'VERIFIED' ? 'Matrícula verificada' : 'Seguimos con tu alta'}
              </h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{gate.message}</p>
              {gate.blocking ? (
                <>
                  <p className="mt-3 text-sm text-ink-soft">
                    No se cobró nada ni se guardaron tus datos. Si creés que es un error del padrón,{' '}
                    <Link href="/contacto" target="_blank" className="font-semibold text-ink underline underline-offset-4">escribinos</Link>.
                  </p>
                  <div className="mt-7 flex flex-wrap justify-end gap-3">
                    <button type="button" onClick={dropOut} className="rounded-full border border-ink/20 px-6 py-3 font-semibold transition hover:bg-pink/20">
                      Darme de baja
                    </button>
                    <button type="button" onClick={() => setGate({ phase: 'closed' })} autoFocus className="rounded-full bg-aqua px-6 py-3 font-semibold transition hover:bg-lime">
                      Corregir mis datos
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-7 flex justify-end">
                  <button type="button" onClick={() => { setGate({ phase: 'closed' }); goToStep(1); }} autoFocus className="inline-flex items-center gap-2 rounded-full bg-aqua px-6 py-3 font-semibold transition hover:bg-lime">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}

          {gate.phase === 'error' && (
            <>
              <h3 id={`${uid}-gate-title`} className="text-2xl font-semibold">No pudimos verificar ahora</h3>
              <p role="alert" className="mt-3 leading-relaxed text-ink-soft">{gate.message}</p>
              <div className="mt-7 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setGate({ phase: 'closed' })} className="rounded-full border border-ink/20 px-6 py-3 font-semibold transition hover:bg-mint">
                  Cerrar
                </button>
                <button type="button" onClick={verifyAgainstRegistry} autoFocus className="rounded-full bg-aqua px-6 py-3 font-semibold transition hover:bg-lime">
                  Reintentar
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
