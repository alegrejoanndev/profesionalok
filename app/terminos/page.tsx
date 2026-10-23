import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { trialMonths } from '@/lib/mercadopago';
import { SITE, TERMS_VERSION } from '@/lib/site';

const TRIAL = trialMonths();
const TRIAL_LABEL = TRIAL === 1 ? '1 mes' : `${TRIAL} meses`;

export const metadata: Metadata = { title: 'Términos legales y condiciones' };

const SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: 'quienes-somos',
    title: '1. Quiénes somos',
    body: [
      `${SITE.name} (${SITE.domain}) es un directorio en línea que permite a profesionales de la salud publicar su perfil y a las personas encontrarlos y contactarlos. El sitio es operado por [RAZÓN SOCIAL / NOMBRE Y APELLIDO], CUIT [XX-XXXXXXXX-X], con domicilio en [DOMICILIO], República Argentina.`,
    ],
  },
  {
    id: 'alcance',
    title: '2. Qué hacemos y qué no hacemos',
    body: [
      `${SITE.name} es solo un espacio de difusión. No presta servicios de salud, no brinda diagnósticos ni tratamientos, no concerta ni cobra turnos y no interviene en la relación entre el profesional y las personas que lo consultan. Cada profesional es el único responsable de la atención que brinda, de sus honorarios y de mantener vigente su matrícula.`,
      'El sitio no es un servicio de emergencias. Ante una urgencia médica, comunicate con el sistema de emergencias de tu zona.',
    ],
  },
  {
    id: 'registro',
    title: '3. Registro y verificación de profesionales',
    body: [
      'Para publicar un perfil, el profesional debe completar el formulario con datos verdaderos y adjuntar su título habilitante. Declara bajo su responsabilidad que la matrícula informada es propia y se encuentra vigente.',
      'Para verificar la habilitación, consultamos la matrícula contra el padrón oficial de profesionales de la salud (REFEPS, del Sistema Integrado de Información Sanitaria Argentino) y comparamos nombre, matrícula, profesión y provincia. Esta verificación se hace ANTES del pago: si la matrícula no figura, no coincide o no está habilitada, no se habilita el pago ni se crea la suscripción, y la persona puede corregir sus datos o darse de baja. Si el padrón no puede consultarse en ese momento, el alta continúa y una persona del equipo verifica la matrícula y revisa la documentación antes de publicar el perfil. Si todo coincide, el perfil puede aprobarse automáticamente.',
      'Podemos rechazar, suspender o eliminar un perfil cuando no se pueda verificar la habilitación profesional, cuando el registro oficial informe que la matrícula ya no está habilitada, cuando la información sea falsa o engañosa, o ante incumplimientos de estos términos. Revisamos periódicamente las matrículas aprobadas.',
    ],
  },
  {
    id: 'membresia',
    title: '4. Modalidad de pago, suscripción y suspensión',
    body: [
      'La publicación del perfil requiere una suscripción mensual de [MONTO] pesos argentinos [IMPUESTOS INCLUIDOS / NO INCLUIDOS], que se cobra por débito automático a través de Mercado Pago. Al suscribirse, el profesional autoriza ese débito recurrente hasta que cancele la suscripción.',
      ...(TRIAL > 0
        ? [
            `La primera suscripción de cada profesional incluye ${TRIAL_LABEL} de prueba gratuita. Durante la prueba no se realiza ningún cobro; el primer débito se produce al finalizar. Si el profesional cancela la suscripción antes de que termine la prueba, no se le cobra. La prueba se otorga por única vez a cada profesional: quien vuelve a suscribirse después de cancelar o de una baja por falta de pago no recibe una nueva prueba.`,
          ]
        : []),
      `Falta de pago y suspensión del perfil: la falta de pago de la suscripción —ya sea por retraso, por fondos insuficientes, por tarjeta vencida o por cualquier otro rechazo del medio de pago— habilita a ${SITE.name} a suspender el perfil profesional, que deja de mostrarse en el directorio hasta que el pago se regularice.`,
      'Si un cobro mensual es rechazado (por ejemplo, por fondos insuficientes o tarjeta vencida), el perfil se oculta del directorio de inmediato y se avisa al email registrado. Mercado Pago reintenta el cobro automáticamente durante un período limitado; si alguno de los reintentos se aprueba, el perfil vuelve a publicarse. Si todos los reintentos fallan, la suscripción se cancela y el profesional puede volver a suscribirse desde el enlace que recibe por email.',
      'El profesional puede cancelar su suscripción en cualquier momento desde su cuenta de Mercado Pago. La cancelación detiene los cobros futuros y oculta el perfil. [DEFINIR POLÍTICA DE REEMBOLSOS Y DERECHO DE REVOCACIÓN CON ASESORAMIENTO LEGAL.]',
      'Los datos de la tarjeta o cuenta de pago los procesa Mercado Pago. Este sitio no los recibe ni los almacena.',
    ],
  },
  {
    id: 'datos',
    title: '5. Datos personales y datos de salud',
    body: [
      `Tratamos los datos personales conforme a la Ley 25.326 de Protección de los Datos Personales. El responsable de la base de datos es [RAZÓN SOCIAL], con domicilio en [DOMICILIO] email de contacto ${SITE.contactEmail} y teléfono ${SITE.phoneDisplay}. [INDICAR NÚMERO DE INSCRIPCIÓN EN EL REGISTRO NACIONAL DE BASES DE DATOS, SI CORRESPONDE.]`,
      'Datos que recopilamos de los profesionales: nombre, apellido, email, teléfono, profesión, especialidades, corrientes, rango etario que atiende, modalidad de atención (presencial, online o ambas), obras sociales, número de matrícula, ubicación, copia del título y, de forma opcional, una fotografía. El profesional informa su DNI o CUIT para que podamos consultar el padrón oficial de matrículas: se usa únicamente para esa consulta y no se almacena ni se muestra. El email y la copia del título son privados: no se muestran en el sitio y solo los usa el equipo para verificar la habilitación y comunicarse con el profesional. El nombre, la profesión, las especialidades, las corrientes, el rango etario, la modalidad, las obras sociales, la matrícula, la localidad, el teléfono de contacto y la fotografía (o, si no la hay, el logo del sitio) se publican en el perfil.',
      'Datos de las personas que visitan el sitio: solo guardamos el nombre, el email y el mensaje que envían por el formulario de contacto, para responderlos. El sitio no pide ni guarda información sobre la salud de quienes lo visitan: la consulta con el profesional ocurre fuera del sitio, por WhatsApp o por el medio que el profesional ofrezca.',
      `Los titulares pueden acceder, rectificar y suprimir sus datos escribiendo a ${SITE.contactEmail}. La Agencia de Acceso a la Información Pública, como órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos por incumplimientos de las normas de protección de datos personales.`,
    ],
  },
  {
    id: 'contenido',
    title: '6. Contenido de los perfiles',
    body: [
      'El profesional es responsable del contenido que publica y garantiza que tiene derecho a usar su fotografía y sus datos. Está prohibido publicar información engañosa, ofrecer tratamientos prohibidos o promesas de resultados garantizados, o cualquier contenido contrario a las normas de ética de su profesión.',
    ],
  },
  {
    id: 'responsabilidad',
    title: '7. Limitación de responsabilidad',
    body: [
      `${SITE.name} no garantiza la cantidad de consultas que recibirá un perfil ni responde por la calidad de la atención brindada por los profesionales, por los acuerdos entre estos y las personas que los consultan ni por interrupciones del servicio ajenas a su control.`,
    ],
  },
  {
    id: 'cambios',
    title: '8. Cambios en estos términos',
    body: [
      'Podemos actualizar estos términos. Cuando el cambio sea relevante lo avisaremos por email a los profesionales registrados. La versión vigente es la publicada en esta página.',
    ],
  },
  {
    id: 'ley',
    title: '9. Ley aplicable y jurisdicción',
    body: ['Estos términos se rigen por las leyes de la República Argentina. [DEFINIR JURISDICCIÓN COMPETENTE CON ASESORAMIENTO LEGAL.]'],
  },
];

export default function TerminosPage() {
  return (
    <>
      <PageHeader title="Términos legales y condiciones" intro={`Versión ${TERMS_VERSION}`} tone="text-lime" />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Índice" className="hidden h-fit lg:sticky lg:top-24 lg:block">
          <ul className="space-y-2 border-l border-ink/15 pl-4 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block py-1 text-ink-soft transition hover:text-ink">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-[72ch]">
          <p role="note" className="mb-10 rounded-2xl bg-lime px-5 py-4 text-sm font-medium leading-relaxed">
            Borrador: este texto es un modelo de partida. Completá los datos entre corchetes y hacelo revisar por un
            abogado antes de publicar el sitio.
          </p>

          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="mb-10 scroll-mt-24">
              <h2 className="text-xl font-semibold">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-3 leading-relaxed text-ink-soft">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <p className="text-sm text-ink-soft">
            ¿Dudas? <Link href="/contacto" className="font-semibold text-ink underline underline-offset-4">Escribinos</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
