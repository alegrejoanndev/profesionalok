/**
 * Prueba automática del cobro de punta a punta:  npm run test:webhook
 *
 * Qué hace:
 *  1. Levanta un "Mercado Pago falso" (servidor local) que responde como la API real.
 *  2. Arranca el sitio con la configuración de prueba (puerto 3100).
 *  3. Crea un profesional de prueba y le manda webhooks FIRMADOS: cobro rechazado, repetido,
 *     aprobado, último reintento fallido, suspensión manual, cancelación, etc.
 *  4. Verifica en la base de datos, en el directorio público y en los mails generados.
 *  5. Borra los datos de prueba.
 *
 * Necesita la base de datos del .env corriendo. No toca Mercado Pago real ni envía mails reales.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { readdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

try {
  process.loadEnvFile('.env');
} catch {
  /* sin .env */
}

import { eq } from 'drizzle-orm';
import { professionals, subscriptions, webhookLogs } from '../db/schema';
import { createCheckoutForProfessional, handlePreapprovalStatus, linkSubscriptionManually } from '../lib/billing';
import { getDb } from '../lib/db';
import { applyMatriculaResult } from '../lib/verification';

const PORT = 3100;
const MP_PORT = 4010;
const BASE = `http://localhost:${PORT}`;
const SECRET = process.env.MP_WEBHOOK_SECRET || 'test-secret';
const EMAILS_DIR = path.join(process.cwd(), '.emails');

// ───────────── Mercado Pago falso ─────────────
type Json = Record<string, unknown>;
const mpState = { payments: new Map<string, Json>(), preapprovals: new Map<string, Json>(), cancelled: [] as string[], created: 0, bodies: [] as Json[] };

const mpServer = http.createServer((req, res) => {
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.headers.authorization !== 'Bearer test-token') return send(401, { message: 'unauthorized' });

  const url = new URL(req.url ?? '/', 'http://x');
  const [, kind, id] = url.pathname.split('/');
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (req.method === 'GET' && kind === 'authorized_payments') {
      const p = mpState.payments.get(id);
      return p ? send(200, p) : send(404, { message: 'not found' });
    }
    if (req.method === 'GET' && kind === 'preapproval') {
      const p = mpState.preapprovals.get(id);
      return p ? send(200, p) : send(404, { message: 'not found' });
    }
    if (req.method === 'PUT' && kind === 'preapproval') {
      const data = JSON.parse(body || '{}') as { status?: string };
      if (data.status === 'cancelled') mpState.cancelled.push(id);
      return send(200, { id, status: data.status });
    }
    if (req.method === 'POST' && kind === 'preapproval') {
      mpState.bodies.push(JSON.parse(body || '{}') as Json);
      const newId = `fake_new_${++mpState.created}`;
      return send(201, { id: newId, status: 'pending', init_point: `http://mp.fake/checkout/${newId}` });
    }
    send(404, { message: 'ruta desconocida' });
  });
});

// ───────────── Utilidades de prueba ─────────────
let serverProc: ChildProcess | null = null;
const createdIds: string[] = [];
const mpIds: string[] = [];
let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m'} ${name}${!ok && detail ? `  →  ${detail}` : ''}`);
}

async function webhook(topic: string, dataId: string, opts: { badSignature?: boolean } = {}) {
  const requestId = crypto.randomUUID();
  const ts = String(Date.now());
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  let v1 = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
  if (opts.badSignature) v1 = '0'.repeat(64);
  const res = await fetch(`${BASE}/api/webhooks/mercadopago?data.id=${dataId}&type=${topic}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
    body: JSON.stringify({ type: topic, data: { id: dataId } }),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as { outcome?: string } };
}

const emailCount = () => {
  try {
    return readdirSync(EMAILS_DIR).length;
  } catch {
    return 0;
  }
};

async function waitForServer(server: ChildProcess) {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error('El servidor de prueba se cerró al arrancar');
    try {
      const r = await fetch(`${BASE}/api/foto/00000000-0000-0000-0000-000000000000`);
      if (r.status === 404) return;
    } catch {
      /* todavía no está listo */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error('El servidor de prueba no arrancó a tiempo');
}

// ───────────── Pruebas ─────────────
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env');
  const db = getDb();
  const tag = crypto.randomBytes(3).toString('hex');
  const preId = `test_pre_${tag}`;
  const cityTag = `Ciudadtest${tag}`;
  const lastName = `Prueba${tag}`;

  await new Promise<void>((r) => mpServer.listen(MP_PORT, r));

  console.log('Arrancando el sitio de prueba…');
  const isWin = process.platform === 'win32';
  const server = spawn(isWin ? 'npx.cmd' : 'npx', ['next', 'dev', '-p', String(PORT)], {
    shell: isWin,
    env: {
      ...process.env,
      MP_MODE: 'live',
      MP_ACCESS_TOKEN: 'test-token',
      MP_API_URL: `http://localhost:${MP_PORT}`,
      MP_WEBHOOK_SECRET: SECRET,
      MEMBERSHIP_PRICE_ARS: '15000',
      TRIAL_MONTHS: '1',
      MP_SUBSCRIPTION_LINK: '',
      MATRICULA_MODE: 'mock',
      MATRICULA_AUTO_APPROVE: 'dni',
      CRON_SECRET: 'cron-test',
      SISA_USER: '',
      SISA_PASSWORD: '',
      NEXT_PUBLIC_APP_URL: BASE,
      NEXT_DIST_DIR: '.next-test',
      RESEND_API_KEY: '',
    },
    stdio: 'ignore',
  });
  serverProc = server;

  const [prof] = await db
    .insert(professionals)
    .values({
      slug: `test-${tag}`, email: `test+${tag}@example.com`, firstName: 'Ana', lastName, phone: '5493410000000',
      profession: 'psicologia', licenseType: 'MP', licenseNumber: tag, licenseProvince: 'Santa Fe',
      city: cityTag, province: 'Santa Fe', verificationStatus: 'APPROVED', verifiedAt: new Date(),
      status: 'ACTIVE', termsAcceptedAt: new Date(), termsVersion: 'test',
    })
    .returning();
  await db.insert(subscriptions).values({ professionalId: prof.id, mpPreapprovalId: preId, status: 'AUTHORIZED', amount: '15000' });

  const state = async () => {
    const [p] = await db.select().from(professionals).where(eq(professionals.id, prof.id));
    const [s] = await db.select().from(subscriptions).where(eq(subscriptions.professionalId, prof.id));
    return { p, s };
  };
  const visible = async () => (await (await fetch(`${BASE}/profesionales?zona=${cityTag}`)).text()).includes(lastName);
  const setPayment = (id: string, status: string, paymentStatus: string, retry = 1) =>
    mpState.payments.set(id, { id, preapproval_id: preId, status, retry_attempt: retry, payment: { status: paymentStatus } });

  try {
    await waitForServer(server);
    console.log('Sitio listo. Ejecutando pruebas:\n');

    console.log('Seguridad');
    check('un webhook con firma inválida se rechaza (401)', (await webhook('subscription_authorized_payment', 'x1', { badSignature: true })).status === 401);
    check('un perfil activo y aprobado aparece en el directorio', await visible());

    console.log('\nCobro rechazado');
    setPayment('ap1', 'recycling', 'rejected');
    const mailsBefore = emailCount();
    let r = await webhook('subscription_authorized_payment', 'ap1');
    check('responde 200 y suspende el perfil', r.status === 200 && r.json.outcome === 'suspended_and_notified', JSON.stringify(r));
    let { p, s } = await state();
    check('el perfil queda INACTIVE por PAYMENT_FAILED (baja lógica)', p.status === 'INACTIVE' && p.inactiveReason === 'PAYMENT_FAILED');
    check('la suscripción queda PAST_DUE', s.status === 'PAST_DUE');
    check('se generó el link para regularizar', !!p.regularizeToken && p.regularizeToken.length === 64);
    check('el perfil desapareció del directorio público', !(await visible()));
    check('se envió el mail de baja por falta de pago', emailCount() === mailsBefore + 1);
    const token1 = p.regularizeToken;

    console.log('\nNotificación duplicada');
    r = await webhook('subscription_authorized_payment', 'ap1');
    check('no vuelve a procesar (already_suspended)', r.json.outcome === 'already_suspended', JSON.stringify(r));
    ({ p } = await state());
    check('no se envía un segundo mail', emailCount() === mailsBefore + 1);
    check('el link de regularización no cambia', p.regularizeToken === token1);

    console.log('\nReintento aprobado');
    setPayment('ap2', 'processed', 'approved', 2);
    r = await webhook('subscription_authorized_payment', 'ap2');
    check('el perfil se reactiva solo', r.json.outcome === 'payment_approved', JSON.stringify(r));
    ({ p, s } = await state());
    check('perfil ACTIVE, suscripción AUTHORIZED y link borrado', p.status === 'ACTIVE' && s.status === 'AUTHORIZED' && p.regularizeToken === null);
    check('vuelve a aparecer en el directorio', await visible());

    console.log('\nÚltimo reintento fallido');
    setPayment('ap3', 'recycling', 'rejected', 1);
    await webhook('subscription_authorized_payment', 'ap3');
    const m2 = emailCount();
    setPayment('ap4', 'processed', 'rejected', 4);
    r = await webhook('subscription_authorized_payment', 'ap4');
    check('se cancela la suscripción y se avisa', r.json.outcome === 'cancelled_and_notified', JSON.stringify(r));
    ({ p, s } = await state());
    check('la suscripción queda CANCELLED', s.status === 'CANCELLED' && s.cancelReason === 'PAYMENT_FAILED');
    check('se canceló en Mercado Pago', mpState.cancelled.includes(preId));
    check('se envió el mail de cancelación', emailCount() === m2 + 1);
    check('el perfil sigue oculto', !(await visible()));

    console.log('\nRegularización (link del mail)');
    const reg = await fetch(`${BASE}/api/regularizar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: p.regularizeToken }),
    });
    const regJson = (await reg.json()) as { initPoint?: string };
    check('el link genera un checkout nuevo', reg.status === 200 && !!regJson.initPoint?.startsWith('http://mp.fake/checkout/'), JSON.stringify(regJson));
    ({ s } = await state());
    check('la suscripción nueva queda PENDING con otro id', s.status === 'PENDING' && s.mpPreapprovalId !== preId);
    check('un token inválido se rechaza', (await fetch(`${BASE}/api/regularizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'x' }) })).status === 400);
    mpState.preapprovals.set(preId, { id: preId, status: 'cancelled' });
    r = await webhook('subscription_preapproval', preId);
    check('los avisos de la suscripción vieja se ignoran', r.json.outcome === 'unknown_subscription', JSON.stringify(r));

    console.log('\nSuspensión manual (admin)');
    const newPre = s.mpPreapprovalId;
    mpState.payments.set('ap5', { id: 'ap5', preapproval_id: newPre, status: 'processed', payment: { status: 'approved' } });
    await db.update(professionals).set({ status: 'INACTIVE', inactiveReason: 'ADMIN' }).where(eq(professionals.id, prof.id));
    await webhook('subscription_authorized_payment', 'ap5');
    ({ p } = await state());
    check('un cobro aprobado NO revierte una suspensión manual', p.status === 'INACTIVE' && p.inactiveReason === 'ADMIN');

    console.log('\nCancelación desde Mercado Pago');
    await db.update(professionals).set({ status: 'ACTIVE', inactiveReason: null }).where(eq(professionals.id, prof.id));
    mpState.preapprovals.set(newPre, { id: newPre, status: 'cancelled' });
    r = await webhook('subscription_preapproval', newPre);
    check('el profesional cancelado por su cuenta se da de baja', r.json.outcome === 'cancelled_by_user', JSON.stringify(r));
    ({ p, s } = await state());
    check('perfil INACTIVE (CANCELLED_BY_USER) y suscripción CANCELLED', p.status === 'INACTIVE' && p.inactiveReason === 'CANCELLED_BY_USER' && s.status === 'CANCELLED');

    console.log('\nOtros');
    mpState.payments.set('ap6', { id: 'ap6', preapproval_id: 'no_existe', status: 'processed', payment: { status: 'approved' } });
    r = await webhook('subscription_authorized_payment', 'ap6');
    check('una suscripción desconocida responde 200 sin romper', r.status === 200 && r.json.outcome === 'unknown_subscription', JSON.stringify(r));
    r = await webhook('payment', '999');
    check('un tópico que no usamos se ignora', r.status === 200 && r.json.outcome === 'ignored_topic', JSON.stringify(r));
    mpState.payments.delete('ap1');
    r = await webhook('subscription_authorized_payment', 'ap1');
    check('si Mercado Pago falla, responde 500 para que reintente', r.status === 500, JSON.stringify(r));

    // ═════════════════════════ MES GRATIS ═════════════════════════
    const mkProf = async (label: string, over: Partial<typeof professionals.$inferInsert> = {}, subOver: Partial<typeof subscriptions.$inferInsert> = {}) => {
      const t = `${label}${crypto.randomBytes(2).toString('hex')}`;
      const [pr] = await db.insert(professionals).values({
        slug: `test-${t}`, email: `test+${t}@example.com`, firstName: 'Bea', lastName: `Prueba${t}`, phone: '5493410000001',
        profession: 'nutricion', licenseType: 'MP', licenseNumber: t, licenseProvince: 'Santa Fe', city: `Ciudadtest${t}`, province: 'Santa Fe',
        verificationStatus: 'APPROVED', verifiedAt: new Date(), status: 'PENDING_PAYMENT', termsAcceptedAt: new Date(), termsVersion: 'test', ...over,
      }).returning();
      createdIds.push(pr.id);
      const preapprovalId = `test_${t}`;
      mpIds.push(preapprovalId);
      await db.insert(subscriptions).values({ professionalId: pr.id, mpPreapprovalId: preapprovalId, status: 'PENDING', amount: '15000', hasTrial: true, ...subOver });
      return { pr, preapprovalId, city: pr.city, last: pr.lastName };
    };
    const get = async (id: string) => ({
      p: (await db.select().from(professionals).where(eq(professionals.id, id)))[0],
      s: (await db.select().from(subscriptions).where(eq(subscriptions.professionalId, id)))[0],
    });
    const listedAt = async (city: string, last: string) => (await (await fetch(`${BASE}/profesionales?zona=${city}`)).text()).includes(last);
    const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

    console.log('\nMes gratis: la suscripción se autoriza');
    const T = await mkProf('trial');
    const nextPay = inDays(30);
    mpState.preapprovals.set(T.preapprovalId, { id: T.preapprovalId, status: 'authorized', next_payment_date: nextPay });
    r = await webhook('subscription_preapproval', T.preapprovalId);
    check('al autorizar empieza la prueba', r.json.outcome === 'trial_started', JSON.stringify(r));
    let g = await get(T.pr.id);
    check('el perfil se ACTIVA sin esperar ningún cobro', g.p.status === 'ACTIVE');
    check('se registra que ya usó su prueba', g.p.trialUsedAt !== null);
    check('la prueba termina cuando Mercado Pago programa el primer cobro', Math.abs((g.s.trialEndsAt?.getTime() ?? 0) - new Date(nextPay).getTime()) < 2000 && g.s.status === 'AUTHORIZED');
    check('y ya se ve en el directorio público (título aprobado)', await listedAt(T.city, T.last));
    const endsAt = g.s.trialEndsAt?.getTime();
    r = await webhook('subscription_preapproval', T.preapprovalId);
    check('un aviso repetido no reinicia la prueba', r.json.outcome === 'authorized' && (await get(T.pr.id)).s.trialEndsAt?.getTime() === endsAt, JSON.stringify(r));

    console.log('\nMes gratis: se cancela durante la prueba');
    mpState.preapprovals.set(T.preapprovalId, { id: T.preapprovalId, status: 'cancelled' });
    r = await webhook('subscription_preapproval', T.preapprovalId);
    g = await get(T.pr.id);
    check('cancelar durante la prueba da de baja el perfil', r.json.outcome === 'cancelled_by_user' && g.p.status === 'INACTIVE' && g.p.inactiveReason === 'CANCELLED_BY_USER');
    check('desaparece del directorio', !(await listedAt(T.city, T.last)));

    console.log('\nMes gratis: no se puede repetir');
    const tok = crypto.randomBytes(32).toString('hex');
    await db.update(professionals).set({ regularizeToken: tok, regularizeTokenExpiresAt: new Date(Date.now() + 86400000) }).where(eq(professionals.id, T.pr.id));
    mpState.bodies.length = 0;
    let rg = await fetch(`${BASE}/api/regularizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tok }) });
    const body1 = mpState.bodies[0] as { auto_recurring?: Json } | undefined;
    check('quien ya usó la prueba vuelve a suscribirse SIN mes gratis', rg.status === 200 && !!body1 && !('free_trial' in (body1.auto_recurring ?? {})), JSON.stringify(body1));
    check('la suscripción nueva queda sin prueba', (await get(T.pr.id)).s.hasTrial === false);

    const N = await mkProf('nuevo', { status: 'INACTIVE', inactiveReason: 'PAYMENT_FAILED', regularizeToken: tok.replace(/./, 'a'), regularizeTokenExpiresAt: new Date(Date.now() + 86400000) });
    mpState.bodies.length = 0;
    rg = await fetch(`${BASE}/api/regularizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: N.pr.regularizeToken }) });
    const body2 = mpState.bodies[0] as { auto_recurring?: { free_trial?: Json; transaction_amount?: number }; external_reference?: string; status?: string } | undefined;
    check('quien nunca tuvo prueba la recibe: free_trial = 1 mes', rg.status === 200 && JSON.stringify(body2?.auto_recurring?.free_trial) === JSON.stringify({ frequency: 1, frequency_type: 'months' }), JSON.stringify(body2));
    check('el checkout lleva precio, referencia del profesional y estado pending', body2?.auto_recurring?.transaction_amount === 15000 && body2?.external_reference === N.pr.id && body2?.status === 'pending');
    check('queda registrado que la suscripción incluye prueba', (await get(N.pr.id)).s.hasTrial === true);

    console.log('\nSin prueba: se activa recién con el primer cobro');
    const D = await mkProf('sinprueba', {}, { hasTrial: false });
    mpState.preapprovals.set(D.preapprovalId, { id: D.preapprovalId, status: 'authorized', next_payment_date: inDays(0) });
    r = await webhook('subscription_preapproval', D.preapprovalId);
    check('autorizar sin prueba NO activa el perfil', r.json.outcome === 'authorized' && (await get(D.pr.id)).p.status === 'PENDING_PAYMENT', JSON.stringify(r));
    mpState.payments.set('apD', { id: 'apD', preapproval_id: D.preapprovalId, status: 'processed', payment: { status: 'approved' } });
    mpIds.push('apD');
    r = await webhook('subscription_authorized_payment', 'apD');
    check('el cobro aprobado sí lo activa', r.json.outcome === 'payment_approved' && (await get(D.pr.id)).p.status === 'ACTIVE', JSON.stringify(r));

    console.log('\nLa prueba no revierte suspensiones');
    const A = await mkProf('admin', { status: 'INACTIVE', inactiveReason: 'ADMIN' });
    mpState.preapprovals.set(A.preapprovalId, { id: A.preapprovalId, status: 'authorized', next_payment_date: inDays(30) });
    await webhook('subscription_preapproval', A.preapprovalId);
    check('una suspensión manual sigue vigente aunque empiece la prueba', (await get(A.pr.id)).p.status === 'INACTIVE');
    const L = await mkProf('licencia', { status: 'INACTIVE', inactiveReason: 'LICENSE_INVALID' }, { hasTrial: false });
    mpState.payments.set('apL', { id: 'apL', preapproval_id: L.preapprovalId, status: 'processed', payment: { status: 'approved' } });
    mpIds.push('apL');
    await webhook('subscription_authorized_payment', 'apL');
    check('un cobro aprobado NO reactiva a quien tiene la matrícula inhabilitada', (await get(L.pr.id)).p.status === 'INACTIVE');

    // ═════════════════════════ ALTA COMPLETA + MATRÍCULA ═════════════════════════
    console.log('\nAlta completa con validación de matrícula (simulador)');
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const onboard = async (lic: string, dni: string, opts: { photo?: boolean; extra?: Record<string, unknown> } = {}) => {
      const t = crypto.randomBytes(3).toString('hex');
      const fd = new FormData();
      fd.set('data', JSON.stringify({
        firstName: 'Ana', lastName: `Alta${t}`, email: `onb+${t}@example.com`, phone: '3482 440552', profession: 'psicologia',
        licenses: { MP: lic }, licenseProvince: 'Santa Fe', city: `Ciudadtest${t}`, province: 'Santa Fe', bio: '', dni, acceptTerms: true,
        specialties: ['Psicología clínica', 'Duelo y pérdidas'], corrientes: ['Gestalt'], ageGroups: ['adolescentes', 'adultos'],
        modalidad: 'AMBAS', obrasSociales: ['PAMI', 'Obra social inventada'], ...opts.extra,
      }));
      if (opts.photo !== false) fd.set('photo', new Blob([PNG], { type: 'image/png' }), 'foto.png');
      fd.set('title', new Blob([PDF], { type: 'application/pdf' }), 'titulo.pdf');
      mpState.bodies.length = 0;
      const res = await fetch(`${BASE}/api/onboarding`, { method: 'POST', body: fd });
      const json = (await res.json()) as { initPoint?: string; matricula?: string | { status: string; blocking: boolean }; error?: string; fieldErrors?: Record<string, string> };
      const [row] = await db.select().from(professionals).where(eq(professionals.email, `onb+${t}@example.com`));
      if (row) createdIds.push(row.id);
      return { res, json, row, t, body: mpState.bodies[0] as { auto_recurring?: { free_trial?: Json } } | undefined };
    };
    const ok1 = await onboard(`9${crypto.randomBytes(2).toString('hex')}`, '12345678');
    check('el alta responde con el checkout y el resultado de la matrícula', ok1.res.status === 200 && ok1.json.matricula === 'VERIFIED' && !!ok1.json.initPoint, JSON.stringify(ok1.json));
    check('matrícula verificada + DNI → se APRUEBA sola (AUTO_REFEPS)', ok1.row?.verificationStatus === 'APPROVED' && ok1.row?.verificationMethod === 'AUTO_REFEPS' && ok1.row?.matriculaStatus === 'VERIFIED');
    check('se guarda la fuente y el momento de la consulta', ok1.row?.matriculaSource === 'MOCK' && ok1.row?.matriculaCheckedAt !== null);
    check('el DNI NO se guardó en ninguna columna', !JSON.stringify(ok1.row).includes('12345678'));
    check('se guardan especialidades (varias), corriente, rango etario, modalidad y obras sociales',
      JSON.stringify(ok1.row?.specialties) === JSON.stringify(['Psicología clínica', 'Duelo y pérdidas']) && JSON.stringify(ok1.row?.corrientes) === '["Gestalt"]' &&
      JSON.stringify(ok1.row?.ageGroups) === '["adolescentes","adultos"]' && ok1.row?.modalidad === 'AMBAS' && JSON.stringify(ok1.row?.obrasSociales) === '["PAMI","Obra social inventada"]', JSON.stringify(ok1.row));
    check('el checkout se creó CON mes gratis', JSON.stringify(ok1.body?.auto_recurring?.free_trial) === JSON.stringify({ frequency: 1, frequency_type: 'months' }), JSON.stringify(ok1.body));
    const subOk = (await get(ok1.row!.id)).s;
    check('la suscripción nace con prueba y sin activar el perfil todavía', subOk.hasTrial === true && ok1.row?.status === 'PENDING_PAYMENT');
    mpState.preapprovals.set(subOk.mpPreapprovalId, { id: subOk.mpPreapprovalId, status: 'authorized', next_payment_date: inDays(30) });
    mpIds.push(subOk.mpPreapprovalId);
    r = await webhook('subscription_preapproval', subOk.mpPreapprovalId);
    check('al autorizar la tarjeta, el perfil se publica solo, sin intervención humana', r.json.outcome === 'trial_started' && (await listedAt(ok1.row!.city, ok1.row!.lastName)), JSON.stringify(r));

    console.log('\nVerificación ANTES del pago');
    const bad = await onboard(`5${crypto.randomBytes(2).toString('hex')}`, '12345678');
    check('matrícula que no figura → se frena (422), sin guardar nada y sin checkout', bad.res.status === 422 && !bad.row && !bad.json.initPoint && mpState.bodies.length === 0, JSON.stringify(bad.json));
    check('la respuesta explica que no figura y marca blocking', typeof bad.json.matricula === 'object' && bad.json.matricula.status === 'NOT_FOUND' && bad.json.matricula.blocking === true && /padrón/.test(bad.json.error ?? ''), JSON.stringify(bad.json));
    const dead = await onboard(`0${crypto.randomBytes(2).toString('hex')}`, '12345678');
    check('matrícula no habilitada → también se frena antes del pago', dead.res.status === 422 && !dead.row && !dead.json.initPoint, JSON.stringify(dead.json));
    const noDni = await onboard(`9${crypto.randomBytes(2).toString('hex')}`, '');
    check('sin DNI/CUIT no se puede avanzar (es lo que confirma la identidad)', noDni.res.status === 400 && !!noDni.json.fieldErrors?.dni && !noDni.row, JSON.stringify(noDni.json));
    const badDni = await onboard(`9${crypto.randomBytes(2).toString('hex')}`, '123');
    check('un DNI mal escrito se rechaza con un mensaje claro', badDni.res.status === 400 && /DNI/.test(JSON.stringify(badDni.json)), JSON.stringify(badDni.json));
    const cuit = await onboard(`9${crypto.randomBytes(2).toString('hex')}`, '20-12345678-6');
    check('también acepta CUIT (se usa el DNI que contiene)', cuit.res.status === 200 && cuit.row?.verificationMethod === 'AUTO_REFEPS' && !JSON.stringify(cuit.row).includes('20123456786'), JSON.stringify(cuit.json));

    console.log('\nPaso previo: /api/matricula/verificar');
    const pre = (lic: string, over: Record<string, unknown> = {}) => fetch(`${BASE}/api/matricula/verificar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Ana', lastName: 'Previa', email: 'previa@example.com', phone: '3482 440552', profession: 'psicologia', licenses: { MP: lic },
        licenseProvince: 'Santa Fe', city: 'Reconquista', province: 'Santa Fe', dni: '12345678', ageGroups: ['adultos'], modalidad: 'ONLINE', ...over,
      }),
    }).then(async (res) => ({ res, json: (await res.json()) as { status?: string; blocking?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> } }));
    let pc = await pre('9001');
    check('matrícula que figura → VERIFIED, no frena', pc.res.status === 200 && pc.json.status === 'VERIFIED' && pc.json.blocking === false, JSON.stringify(pc.json));
    pc = await pre('5001');
    check('matrícula que no figura → NOT_FOUND y frena', pc.json.status === 'NOT_FOUND' && pc.json.blocking === true, JSON.stringify(pc.json));
    pc = await pre('0001');
    check('matrícula no habilitada → NOT_ENABLED y frena', pc.json.status === 'NOT_ENABLED' && pc.json.blocking === true, JSON.stringify(pc.json));
    pc = await pre('9001', { dni: '' });
    check('sin DNI/CUIT pide el dato (400)', pc.res.status === 400 && !!pc.json.fieldErrors?.dni, JSON.stringify(pc.json));
    pc = await pre('9001', { ageGroups: [] });
    check('sin rango etario → 400 con el campo marcado', pc.res.status === 400 && !!pc.json.fieldErrors?.ageGroups, JSON.stringify(pc.json));
    check('el mensaje nunca incluye datos del padrón ni el DNI', !/12345678|GOMEZ/.test(JSON.stringify((await pre('5002')).json)));

    console.log('\nFoto opcional y datos del perfil');
    const nophoto = await onboard(`9${crypto.randomBytes(2).toString('hex')}`, '12345678', { photo: false });
    check('el alta funciona SIN foto (se mostrará el logo)', nophoto.res.status === 200 && nophoto.row?.photoUrl === null, JSON.stringify(nophoto.json));
    const noAge = await onboard(`9${crypto.randomBytes(2).toString('hex')}`, '12345678', { extra: { ageGroups: [] } });
    check('el rango etario es obligatorio', noAge.res.status === 400 && !!noAge.json.fieldErrors?.ageGroups && !noAge.row);
    const noMod = await onboard(`9${crypto.randomBytes(2).toString('hex')}`, '12345678', { extra: { modalidad: '' } });
    check('la modalidad es obligatoria', noMod.res.status === 400 && !!noMod.json.fieldErrors?.modalidad);
    const badSpec = await onboard(`9${crypto.randomBytes(2).toString('hex')}`, '12345678', { extra: { specialties: ['Cardiología'] } });
    check('una especialidad de otra profesión se rechaza', badSpec.res.status === 400 && !!badSpec.json.fieldErrors?.specialties);
    const badCorr = await onboard(`9${crypto.randomBytes(2).toString('hex')}`, '12345678', { extra: { profession: 'nutricion', corrientes: ['Gestalt'], specialties: [] } });
    check('las corrientes solo existen para Psicología', badCorr.res.status === 400 && !!badCorr.json.fieldErrors?.corrientes);

    console.log('\nBuscador: localidades múltiples y filtros');
    const dir = async (qs: string) => (await (await fetch(`${BASE}/profesionales?${qs}`)).text());
    const tag1 = ok1.row!.city, tag2 = cuit.row!.city;
    // El perfil del alta con CUIT todavía no está publicado: se autoriza su suscripción para que aparezca en el directorio
    const subCuit = (await get(cuit.row!.id)).s;
    mpState.preapprovals.set(subCuit.mpPreapprovalId, { id: subCuit.mpPreapprovalId, status: 'authorized', next_payment_date: inDays(30) });
    mpIds.push(subCuit.mpPreapprovalId);
    await webhook('subscription_preapproval', subCuit.mpPreapprovalId);
    const both = await dir(`zona=${encodeURIComponent(`${tag1}, ${tag2}`)}`);
    check('varias localidades separadas por coma encuentran perfiles de cada una', both.includes(ok1.row!.lastName) && both.includes(cuit.row!.lastName));
    check('"A y B" también separa localidades', (await dir(`zona=${encodeURIComponent(`${tag1} y ${tag2}`)}`)).includes(ok1.row!.lastName));
    const f1 = await dir(`zona=${tag1}&edad=ninos`);
    check('filtro por edad: sin niños no aparece quien atiende solo adolescentes y adultos', !f1.includes(ok1.row!.lastName));
    check('filtro por edad: adolescentes sí', (await dir(`zona=${tag1}&edad=adolescentes`)).includes(ok1.row!.lastName));
    check('filtro por corriente', (await dir(`zona=${tag1}&corriente=Gestalt`)).includes(ok1.row!.lastName) && !(await dir(`zona=${tag1}&corriente=Sist%C3%A9mica`)).includes(ok1.row!.lastName));
    check('filtro por especialidad', (await dir(`zona=${tag1}&especialidad=${encodeURIComponent('Duelo y pérdidas')}`)).includes(ok1.row!.lastName));
    check('filtro por obra social', (await dir(`zona=${tag1}&obra=PAMI`)).includes(ok1.row!.lastName) && !(await dir(`zona=${tag1}&obra=OSDE`)).includes(ok1.row!.lastName));
    check('modalidad "ambas" aparece al buscar presencial y online', (await dir(`zona=${tag1}&modalidad=ONLINE`)).includes(ok1.row!.lastName) && (await dir(`zona=${tag1}&modalidad=PRESENCIAL`)).includes(ok1.row!.lastName));
    check('el directorio ya no ordena por destacados ni por valoración', !/mejor valorad|Ordenar por/i.test(await dir('')));

    // ═════════════════════════ REGLAS DE APROBACIÓN AUTOMÁTICA ═════════════════════════
    console.log('\nReglas de la aprobación automática');
    const weak = { status: 'VERIFIED' as const, detail: 'ok', source: 'REFEPS' as const, method: 'name' as const };
    const W = await mkProf('debil', { verificationStatus: 'PENDING', verifiedAt: null });
    await applyMatriculaResult(W.pr.id, weak, 'onboarding');
    check('identidad débil (solo nombre + matrícula) NO aprueba sola', (await get(W.pr.id)).p.verificationStatus === 'PENDING' && (await get(W.pr.id)).p.matriculaStatus === 'VERIFIED');
    process.env.MATRICULA_AUTO_APPROVE = 'always';
    await applyMatriculaResult(W.pr.id, weak, 'onboarding');
    check('con la política "always" sí aprueba', (await get(W.pr.id)).p.verificationStatus === 'APPROVED');
    process.env.MATRICULA_AUTO_APPROVE = 'never';
    const W2 = await mkProf('nunca', { verificationStatus: 'PENDING', verifiedAt: null });
    await applyMatriculaResult(W2.pr.id, { ...weak, method: 'dni' }, 'onboarding');
    check('con la política "never" nunca aprueba, ni con DNI', (await get(W2.pr.id)).p.verificationStatus === 'PENDING');
    process.env.MATRICULA_AUTO_APPROVE = 'dni';
    const RJ = await mkProf('rechazado', { verificationStatus: 'REJECTED' });
    await applyMatriculaResult(RJ.pr.id, { ...weak, method: 'dni' }, 'onboarding');
    check('un perfil rechazado por una persona NO se re-aprueba solo', (await get(RJ.pr.id)).p.verificationStatus === 'REJECTED');

    console.log('\nRevalidación periódica de matrículas');
    const V = await mkProf('vigente', { status: 'ACTIVE', matriculaStatus: 'VERIFIED', verificationMethod: 'AUTO_REFEPS' }, { status: 'AUTHORIZED', hasTrial: false });
    await applyMatriculaResult(V.pr.id, { status: 'UNAVAILABLE', detail: 'sin respuesta', source: 'REFEPS' }, 'cron');
    check('si el registro no responde, NO se cambia nada', (await get(V.pr.id)).p.status === 'ACTIVE' && (await get(V.pr.id)).p.matriculaStatus === 'VERIFIED');
    await applyMatriculaResult(V.pr.id, { status: 'NOT_FOUND', detail: 'no figura', source: 'REFEPS', method: 'code' }, 'cron');
    check('si deja de figurar, solo se registra (no se oculta)', (await get(V.pr.id)).p.status === 'ACTIVE' && (await get(V.pr.id)).p.matriculaStatus === 'NOT_FOUND');
    await applyMatriculaResult(V.pr.id, { status: 'NOT_ENABLED', detail: 'suspendida', source: 'REFEPS', method: 'code' }, 'cron');
    g = await get(V.pr.id);
    check('si el registro informa NO habilitada: se oculta (LICENSE_INVALID) y vuelve a revisión', g.p.status === 'INACTIVE' && g.p.inactiveReason === 'LICENSE_INVALID' && g.p.verificationStatus === 'PENDING');
    check('y sale del directorio', !(await listedAt(V.city, V.last)));
    await applyMatriculaResult(V.pr.id, { status: 'VERIFIED', detail: 'ok', source: 'REFEPS', method: 'code' }, 'cron');
    g = await get(V.pr.id);
    check('si la matrícula vuelve a estar habilitada, se reactiva sola', g.p.status === 'ACTIVE' && g.p.verificationStatus === 'APPROVED' && g.p.inactiveReason === null);
    const cr = await fetch(`${BASE}/api/cron/revalidar`);
    check('el chequeo periódico sin clave se rechaza (401)', cr.status === 401);
    const cr2 = await fetch(`${BASE}/api/cron/revalidar`, { headers: { Authorization: 'Bearer incorrecta' } });
    check('con clave incorrecta también (401)', cr2.status === 401);
    const cr3 = await fetch(`${BASE}/api/cron/revalidar`, { headers: { Authorization: 'Bearer cron-test' } });
    check('con la clave correcta responde (omite si no hay registro oficial activo)', cr3.status === 200 && 'skipped' in ((await cr3.json()) as Json));

    // ═════════════════════════ MODO ENLACE ═════════════════════════
    console.log('\nModo enlace (link de suscripción de tu panel de Mercado Pago)');
    Object.assign(process.env, { MP_MODE: 'live', MP_ACCESS_TOKEN: 'test-token', MP_API_URL: `http://localhost:${MP_PORT}`, MP_SUBSCRIPTION_LINK: 'https://mpago.la/1TeHYiV', MEMBERSHIP_PRICE_ARS: '15000', TRIAL_MONTHS: '1' });
    const K = await mkProf('enlace', {}, { mpPreapprovalId: `placeholder_${crypto.randomBytes(2).toString('hex')}` });
    await db.delete(subscriptions).where(eq(subscriptions.professionalId, K.pr.id));
    mpState.bodies.length = 0;
    const url = await createCheckoutForProfessional({ id: K.pr.id, email: K.pr.email });
    g = await get(K.pr.id);
    check('devuelve tu link y NO llama a la API para crear un checkout', url === 'https://mpago.la/1TeHYiV' && mpState.bodies.length === 0);
    check('guarda la suscripción pendiente, con prueba', g.s.mpPreapprovalId === `link_${K.pr.id}` && g.s.hasTrial === true && g.s.status === 'PENDING');
    mpIds.push(`real_${K.pr.id}`);
    mpState.preapprovals.set(`real_${K.pr.id}`, { id: `real_${K.pr.id}`, status: 'authorized', payer_email: K.pr.email.toUpperCase(), next_payment_date: inDays(30) });
    let out = await handlePreapprovalStatus({ id: `real_${K.pr.id}`, status: 'authorized' });
    g = await get(K.pr.id);
    check('al llegar el aviso, vincula la suscripción por el email (sin importar mayúsculas)', out === 'trial_started' && g.s.mpPreapprovalId === `real_${K.pr.id}`, out);
    check('y activa el perfil', g.p.status === 'ACTIVE');

    const K2 = await mkProf('enlace2');
    await db.update(subscriptions).set({ mpPreapprovalId: `link_${K2.pr.id}` }).where(eq(subscriptions.professionalId, K2.pr.id));
    mpIds.push('real_otro');
    mpState.preapprovals.set('real_otro', { id: 'real_otro', status: 'authorized', payer_email: 'otra-persona@example.com', next_payment_date: inDays(30) });
    out = await handlePreapprovalStatus({ id: 'real_otro', status: 'authorized' });
    check('si el email no coincide con nadie, NO adivina: queda sin vincular', out === 'unknown_subscription' && (await get(K2.pr.id)).p.status === 'PENDING_PAYMENT', out);
    out = await linkSubscriptionManually('real_otro', K2.pr.id);
    g = await get(K2.pr.id);
    check('un administrador puede vincularla a mano', out === 'trial_started' && g.p.status === 'ACTIVE' && g.s.mpPreapprovalId === 'real_otro', out);
    let dup = '';
    try { await linkSubscriptionManually('real_otro', K.pr.id); } catch (e) { dup = (e as Error).message; }
    check('no se puede vincular dos veces la misma suscripción', /ya está vinculada/.test(dup), dup);
  } finally {
    server.kill();
    if (isWin) spawn('taskkill', ['/pid', String(server.pid), '/f', '/t']);
    mpServer.close();
    for (const id of [prof.id, ...createdIds]) {
      await db.delete(subscriptions).where(eq(subscriptions.professionalId, id));
      await db.delete(professionals).where(eq(professionals.id, id));
    }
    for (const id of ['x1', 'ap1', 'ap2', 'ap3', 'ap4', 'ap5', 'ap6', '999', preId, ...mpIds]) await db.delete(webhookLogs).where(eq(webhookLogs.resourceId, id));
  }

  console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed} pruebas correctas, ${failed} con error\x1b[0m`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  serverProc?.kill();
  mpServer.close();
  console.error('\nLa prueba no pudo completarse:', e);
  process.exit(1);
});
