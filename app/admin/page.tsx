import { and, desc, eq, isNull, like, sql } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { professionals, subscriptions, webhookLogs } from '@/db/schema';
import { Avatar } from '@/components/Avatar';
import { ageLabel, modalityLabel } from '@/lib/catalog';
import { getDb, hasDatabase } from '@/lib/db';
import { LICENSE_SHORT, getProfession } from '@/lib/professions';
import { isLinkMode } from '@/lib/mercadopago';
import { matriculaMode } from '@/lib/matricula';
import { approve, linkSubscription, recheckMatricula, reject, restore, softDelete, suspend, toggleFeatured } from './actions';

export const metadata: Metadata = { title: 'Panel interno', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'pendientes', label: 'Por revisar' },
  { key: 'aprobados', label: 'Aprobados' },
  { key: 'rechazados', label: 'Rechazados' },
  { key: 'todos', label: 'Todos' },
] as const;

const btn = 'rounded-full px-4 py-2 text-sm font-semibold transition';

const MATRICULA_LABEL: Record<string, { text: string; tone: string }> = {
  VERIFIED: { text: 'Matrícula: verificada en el registro', tone: 'bg-lime' },
  NOT_CHECKED: { text: 'Matrícula: sin consultar', tone: 'bg-ash/40' },
  MISMATCH: { text: 'Matrícula: datos que no coinciden', tone: 'bg-lavender' },
  NOT_FOUND: { text: 'Matrícula: no figura en el registro', tone: 'bg-lavender' },
  NOT_ENABLED: { text: 'Matrícula: NO habilitada', tone: 'bg-pink/40' },
  UNAVAILABLE: { text: 'Matrícula: registro sin respuesta', tone: 'bg-ash/40' },
};
const fmt = (d: Date | null) => (d ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = 'pendientes' } = await searchParams;

  if (!hasDatabase()) {
    return <p className="mx-auto max-w-3xl p-10">Falta configurar DATABASE_URL.</p>;
  }

  const filter =
    f === 'aprobados' ? eq(professionals.verificationStatus, 'APPROVED')
    : f === 'rechazados' ? eq(professionals.verificationStatus, 'REJECTED')
    : f === 'todos' ? undefined
    : eq(professionals.verificationStatus, 'PENDING');

  const rows = await getDb()
    .select({ p: professionals, sub: subscriptions.status, failed: subscriptions.failedAttempts, hasTrial: subscriptions.hasTrial, trialEndsAt: subscriptions.trialEndsAt })
    .from(professionals)
    .leftJoin(subscriptions, eq(subscriptions.professionalId, professionals.id))
    .where(and(isNull(professionals.deletedAt), filter))
    .orderBy(desc(professionals.createdAt))
    .limit(100);

  const [counts] = await getDb()
    .select({ pending: sql<number>`count(*) filter (where ${professionals.verificationStatus} = 'PENDING')::int` })
    .from(professionals)
    .where(isNull(professionals.deletedAt));

  // Modo enlace: pagos de Mercado Pago que no se pudieron asociar a ningún profesional por el email
  let unmatched: { id: string }[] = [];
  let waitingLink: { id: string; name: string; email: string }[] = [];
  if (isLinkMode()) {
    const db = getDb();
    unmatched = await db
      .selectDistinct({ id: webhookLogs.resourceId })
      .from(webhookLogs)
      .where(and(eq(webhookLogs.topic, 'subscription_preapproval'), eq(webhookLogs.outcome, 'unknown_subscription')))
      .limit(20);
    waitingLink = (
      await db
        .select({ id: professionals.id, first: professionals.firstName, last: professionals.lastName, email: professionals.email })
        .from(professionals)
        .innerJoin(subscriptions, eq(subscriptions.professionalId, professionals.id))
        .where(and(like(subscriptions.mpPreapprovalId, 'link_%'), isNull(professionals.deletedAt)))
    ).map((r) => ({ id: r.id, name: `${r.first} ${r.last}`, email: r.email }));
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl tracking-wide">Panel interno</h1>
          <p className="mt-1 text-ink-soft">{counts.pending} {counts.pending === 1 ? 'perfil espera' : 'perfiles esperan'} revisión.</p>
        </div>
        <Link href="/" className="text-sm font-semibold underline underline-offset-4">Ver el sitio</Link>
      </div>

      <nav aria-label="Filtros" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link key={x.key} href={`/admin?f=${x.key}`} aria-current={f === x.key ? 'page' : undefined}
            className={`${btn} border border-ink/20 ${f === x.key ? 'bg-ink text-white' : 'hover:bg-mint'}`}>
            {x.label}
          </Link>
        ))}
      </nav>

      {isLinkMode() && unmatched.length > 0 && waitingLink.length > 0 && (
        <section className="mt-8 rounded-[24px] bg-lavender/50 p-5">
          <h2 className="font-semibold">Pagos de Mercado Pago sin vincular</h2>
          <p className="mt-1 text-sm">Alguien se suscribió con un email distinto al registrado. Elegí a quién corresponde cada suscripción.</p>
          <div className="mt-4 space-y-3">
            {unmatched.map((u) => (
              <form key={u.id} action={linkSubscription} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="preapproval" value={u.id} />
                <code className="rounded-full bg-white px-3 py-2 text-xs">{u.id}</code>
                <select name="professional" aria-label="Profesional" className="rounded-full border border-ink/20 bg-white px-4 py-2 text-sm">
                  {waitingLink.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.email})</option>)}
                </select>
                <button className={`${btn} bg-ink text-white hover:bg-ink-soft`}>Vincular</button>
              </form>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 space-y-5">
        {rows.length === 0 && <p className="rounded-[24px] border border-dashed border-ink/25 p-8 text-ink-soft">No hay perfiles en esta vista.</p>}

        {rows.map(({ p, sub, failed, hasTrial, trialEndsAt }) => {
          const extra = Object.entries(p.extraLicenses ?? {}).map(([k, val]) => `${LICENSE_SHORT[k] ?? k} ${val}`);
          return (
            <article key={p.id} className="rounded-[28px] border border-ink/10 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start gap-5">
                <Avatar name={`${p.firstName} ${p.lastName}`} photoUrl={p.photoUrl} tone="aqua" className="h-20 w-20" />

                <div className="min-w-[14rem] flex-1">
                  <h2 className="text-lg font-semibold">{p.firstName} {p.lastName}</h2>
                  <p className="text-sm text-ink-soft">{getProfession(p.profession)?.label} · {p.city}, {p.province}</p>
                  <p className="mt-2 text-sm">
                    <strong>{LICENSE_SHORT[p.licenseType] ?? p.licenseType} {p.licenseNumber}</strong> ({p.licenseProvince})
                    {extra.length > 0 && <span className="text-ink-soft"> · {extra.join(' · ')}</span>}
                  </p>
                  <p className="text-sm text-ink-soft">{p.email} · +{p.phone}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {modalityLabel(p.modalidad)} · {p.ageGroups.map(ageLabel).join(', ') || 'sin rango etario'}
                    {p.specialties.length > 0 && <> · Especialidades: {p.specialties.join(', ')}</>}
                    {p.corrientes.length > 0 && <> · Corrientes: {p.corrientes.join(', ')}</>}
                  </p>
                  {p.obrasSociales.length > 0 && <p className="text-sm text-ink-soft">Obras sociales: {p.obrasSociales.join(', ')}</p>}
                  {p.bio && <p className="mt-2 max-w-[70ch] text-sm text-ink-soft">{p.bio}</p>}
                  {p.rejectionNote && <p className="mt-2 text-sm"><strong>Motivo del rechazo:</strong> {p.rejectionNote}</p>}
                  {p.matriculaDetail && (
                    <p className="mt-2 text-sm text-ink-soft">
                      <strong className="text-ink">Registro oficial:</strong> {p.matriculaDetail}
                      {p.matriculaCheckedAt && ` (consultado el ${fmt(p.matriculaCheckedAt)}, ${p.matriculaSource ?? 'sin fuente'})`}
                    </p>
                  )}
                  {p.verificationMethod === 'AUTO_REFEPS' && p.verificationStatus === 'APPROVED' && (
                    <p className="mt-1 text-sm text-ink-soft">Aprobado automáticamente por la verificación de matrícula.</p>
                  )}
                </div>

                <dl className="flex w-full flex-wrap gap-2 text-xs font-semibold">
                  <div className={`rounded-full px-3 py-1.5 ${p.verificationStatus === 'APPROVED' ? 'bg-lime' : p.verificationStatus === 'REJECTED' ? 'bg-pink/30' : 'bg-lavender'}`}>
                    <dt className="sr-only">Título</dt><dd>Título: {p.verificationStatus}</dd>
                  </div>
                  <div className={`rounded-full px-3 py-1.5 ${p.status === 'ACTIVE' ? 'bg-aqua' : 'bg-ash'}`}>
                    <dt className="sr-only">Perfil</dt><dd>Perfil: {p.status}{p.inactiveReason ? ` (${p.inactiveReason})` : ''}</dd>
                  </div>
                  <div className={`rounded-full px-3 py-1.5 ${(MATRICULA_LABEL[p.matriculaStatus] ?? MATRICULA_LABEL.NOT_CHECKED).tone}`}>
                    <dt className="sr-only">Matrícula</dt><dd>{(MATRICULA_LABEL[p.matriculaStatus] ?? MATRICULA_LABEL.NOT_CHECKED).text}</dd>
                  </div>
                  <div className="rounded-full bg-mint px-3 py-1.5">
                    <dt className="sr-only">Suscripción</dt><dd>Cobro: {sub ?? 'sin suscripción'}{failed ? ` · ${failed} fallidos` : ''}</dd>
                  </div>
                  {hasTrial && (
                    <div className="rounded-full bg-lime px-3 py-1.5">
                      <dt className="sr-only">Prueba gratis</dt>
                      <dd>{trialEndsAt ? `Prueba gratis hasta el ${fmt(trialEndsAt)}` : 'Prueba gratis (sin iniciar)'}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
                {p.titleDocPath ? (
                  <a href={`/admin/titulo/${p.id}`} target="_blank" rel="noopener" className={`${btn} inline-flex items-center gap-1.5 bg-ink text-white hover:bg-ink-soft`}>
                    Ver título <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : <span className="text-sm text-ink-soft">Sin título cargado</span>}

                {p.verificationStatus !== 'APPROVED' && (
                  <form action={approve}><input type="hidden" name="id" value={p.id} />
                    <button className={`${btn} bg-aqua hover:bg-lime`}>Aprobar</button></form>
                )}
                {p.verificationStatus !== 'REJECTED' && (
                  <form action={reject} className="flex items-center gap-2"><input type="hidden" name="id" value={p.id} />
                    <input name="note" placeholder="Motivo (opcional)" aria-label="Motivo del rechazo" className="w-44 rounded-full border border-ink/20 px-4 py-2 text-sm outline-none focus:border-ink" />
                    <button className={`${btn} bg-pink hover:bg-lavender`}>Rechazar</button></form>
                )}
                {matriculaMode() !== 'off' && (
                  <form action={recheckMatricula}><input type="hidden" name="id" value={p.id} />
                    <button className={`${btn} border border-ink/20 hover:bg-mint`}>Verificar matrícula</button></form>
                )}
                <form action={toggleFeatured}><input type="hidden" name="id" value={p.id} />
                  <button className={`${btn} border border-ink/20 hover:bg-mint`}>{p.isFeatured ? 'Quitar de destacados' : 'Destacar'}</button></form>
                {p.inactiveReason === 'ADMIN' ? (
                  <form action={restore}><input type="hidden" name="id" value={p.id} />
                    <button className={`${btn} border border-ink/20 hover:bg-mint`}>Levantar suspensión</button></form>
                ) : (
                  <form action={suspend}><input type="hidden" name="id" value={p.id} />
                    <button className={`${btn} border border-ink/20 hover:bg-ash/40`}>Suspender</button></form>
                )}
                <form action={softDelete} className="ml-auto"><input type="hidden" name="id" value={p.id} />
                  <button className={`${btn} text-[#B4125A] hover:bg-pink/15`}>Eliminar</button></form>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
