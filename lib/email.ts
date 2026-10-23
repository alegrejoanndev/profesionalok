import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { COLORS } from './colors';
import { SITE } from './site';

type Mail = { to: string; subject: string; html: string; text: string };

/** Sin RESEND_API_KEY los mails no se pierden: se guardan como HTML en ./.emails para poder revisarlos. */
async function saveToDisk(mail: Mail) {
  const dir = path.join(process.cwd(), '.emails');
  await mkdir(dir, { recursive: true });
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}_${mail.to.replace(/[^a-z0-9@.-]/gi, '_')}.html`;
  await writeFile(path.join(dir, name), `<!-- Para: ${mail.to} | Asunto: ${mail.subject} -->\n${mail.html}`);
  console.log(`[email] (sin RESEND_API_KEY) guardado en .emails/${name} — asunto: "${mail.subject}"`);
}

/**
 * Envío vía Resend (API REST, sin dependencias). Para usar otro proveedor
 * (SES, Postmark, Nodemailer) cambiá solo esta función.
 */
export async function send(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return saveToDisk(mail);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? `${SITE.name} <no-responder@${SITE.domain}>`,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, bodyHtml: string, cta: { label: string; url: string }) {
  return `<!doctype html><html lang="es-AR"><body style="margin:0;background:${COLORS.paper};font-family:Poppins,Arial,sans-serif;color:${COLORS.ink}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:24px;overflow:hidden">
      <tr><td style="background:${COLORS.aqua};padding:20px 28px;font-size:22px;font-weight:600">${esc(SITE.name)}</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 16px;font-size:22px">${esc(title)}</h1>
        ${bodyHtml}
        <p style="margin:28px 0 0"><a href="${cta.url}" style="display:inline-block;background:${COLORS.pink};color:${COLORS.ink};text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px">${esc(cta.label)}</a></p>
        <p style="margin:24px 0 0;font-size:12px;color:${COLORS.inkSoft}">Si el botón no funciona, copiá este enlace en tu navegador:<br>${cta.url}</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export const regularizeUrl = (token: string) => `${SITE.url}/regularizar/${token}`;

/** Primer rechazo: el perfil se oculta y se ofrece regularizar. */
export async function sendPaymentFailedEmail(p: { to: string; firstName: string; token: string }) {
  const url = regularizeUrl(p.token);
  await send({
    to: p.to,
    subject: 'No pudimos cobrar tu suscripción: tu perfil dejó de estar visible',
    html: layout(
      `Hola ${p.firstName}, no pudimos cobrar tu suscripción`,
      `<p style="line-height:1.6;margin:0 0 12px">El débito automático de este mes fue rechazado (por ejemplo, por fondos insuficientes o una tarjeta vencida).</p>
       <p style="line-height:1.6;margin:0">Mientras tanto, <strong>tu perfil se ocultó del directorio</strong>. Podés volver a activarlo en pocos minutos actualizando tu medio de pago.</p>`,
      { label: 'Regularizar mi suscripción', url },
    ),
    text: `Hola ${p.firstName}: no pudimos cobrar tu suscripción y tu perfil dejó de estar visible en ${SITE.name}.\nRegularizá tu situación acá: ${url}`,
  });
}

/** Mercado Pago agotó los reintentos y la suscripción se canceló. */
export async function sendSubscriptionCancelledEmail(p: { to: string; firstName: string; token: string }) {
  const url = regularizeUrl(p.token);
  await send({
    to: p.to,
    subject: 'Cancelamos tu suscripción por falta de pago',
    html: layout(
      `Hola ${p.firstName}, tu suscripción fue cancelada`,
      `<p style="line-height:1.6;margin:0 0 12px">Después de varios intentos no pudimos cobrar tu suscripción, así que cancelamos la suscripción.</p>
       <p style="line-height:1.6;margin:0">Tu perfil sigue oculto. Cuando quieras, podés volver a suscribirte y se publica de nuevo.</p>`,
      { label: 'Volver a suscribirme', url },
    ),
    text: `Hola ${p.firstName}: cancelamos tu suscripción en ${SITE.name} por falta de pago.\nPodés volver a suscribirte acá: ${url}`,
  });
}

/** Aviso interno cuando alguien completa el formulario de Contacto. */
export async function sendContactNotification(m: { name: string; email: string; topic: string; message: string }) {
  const to = process.env.CONTACT_TO || SITE.contactEmail;
  if (!to) return;
  await send({
    to,
    subject: `Contacto web (${m.topic}): ${m.name}`,
    html: `<p><strong>${esc(m.name)}</strong> &lt;${esc(m.email)}&gt;</p><p>Tema: ${esc(m.topic)}</p><p style="white-space:pre-wrap">${esc(m.message)}</p>`,
    text: `${m.name} <${m.email}>\nTema: ${m.topic}\n\n${m.message}`,
  });
}
