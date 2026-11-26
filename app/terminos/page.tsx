import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { LEGAL, SITE, TERMS_UPDATED, TERMS_VERSION } from '@/lib/site';

export const metadata: Metadata = { title: 'Términos y condiciones y políticas de privacidad' };

type Block = { p: string } | { list: string[] } | { h: string };
type Section = { id: string; title: string; blocks: Block[] };

const NAME = SITE.name;

/** I. TÉRMINOS Y CONDICIONES */
const TERMS: Section[] = [
  {
    id: 'quienes-somos',
    title: '1. Quiénes somos',
    blocks: [
      {
        p: `${NAME} (${SITE.domain}) es un directorio en línea que permite a profesionales de la salud publicar su perfil y a las personas encontrarlos y contactarlos. El sitio es operado por ${LEGAL.operator}, CUIT ${LEGAL.cuit}, con domicilio en ${LEGAL.address}, República Argentina.`,
      },
    ],
  },
  {
    id: 'servicio',
    title: '2. Qué servicio brindamos. Servicios no incluidos.',
    blocks: [
      {
        p: `“${NAME}” es un espacio de difusión. Es un DIRECTORIO el que se define como el entorno digital, sitio web y/o aplicación provisto por ${NAME}, cuyo objeto exclusivo es indexar, organizar y poner a disposición del público información de contacto, perfil académico y áreas de especialidad de profesionales de la salud mental debidamente matriculados. ${NAME} opera únicamente como un catálogo informativo publicitario e intermediario de visualización en línea.`,
      },
      {
        p: `En ningún caso ${NAME} presta, comercializa, supervisa ni garantiza servicios médicos, psicoterapéuticos o de atención en salud mental, no brinda diagnósticos ni tratamientos, no concerta ni cobra turnos, ni sustituye la relación profesional, ética y contractual que se constituya de forma directa entre el Usuario/Paciente y el Profesional anunciado.`,
      },
      { p: 'Cada profesional es el único responsable de la atención que brinda, de sus honorarios y de mantener vigente su matrícula.' },
      { p: 'El sitio no es un servicio de emergencias. Ante una urgencia médica, comuníquese con el sistema de emergencias de tu zona.' },
    ],
  },
  {
    id: 'registro',
    title: '3. Registro y verificación de profesionales',
    blocks: [
      {
        p: 'Para publicar un perfil, el profesional debe completar el formulario con datos verdaderos. Declara bajo su responsabilidad que la matrícula informada es propia y se encuentra vigente.',
      },
      {
        p: 'Para verificar la habilitación, consultamos la matrícula contra la lista de matriculados del Colegio de Psicólogos de la Provincia de Santa Fe y comparamos nombre y número de matrícula. Esta verificación se hace ANTES del pago: si una matrícula de Santa Fe no figura o no coincide, no se habilita el pago ni se crea la suscripción, y la persona puede corregir sus datos o darse de baja. Las matrículas de otras provincias no se pueden consultar automáticamente: el alta continúa y una persona del equipo verifica la matrícula antes de publicar el perfil.',
      },
      {
        p: 'Podemos rechazar, suspender o eliminar un perfil cuando no se pueda verificar la habilitación profesional, cuando el registro oficial informe que la matrícula ya no está habilitada, cuando la información sea falsa o engañosa, o ante incumplimientos de estos términos. Revisamos las matrículas aprobadas.',
      },
      {
        p: 'Esta página y sus componentes se ofrecen únicamente con fines informativos; esta página no se hace responsable de la exactitud, utilidad o disponibilidad de cualquier información que se transmita o ponga a disposición a través de la misma; no será responsable por cualquier error u omisión en dicha información.',
      },
    ],
  },
  {
    id: 'suscripcion',
    title: '4. Suscripción y pagos.',
    blocks: [
      {
        p: `La publicación del perfil requiere una suscripción mensual de ${LEGAL.price} pesos argentinos ${LEGAL.taxes}, que se cobra por débito automático a través de Mercado Pago. Al suscribirse, el profesional autoriza ese débito recurrente hasta que cancele la suscripción.`,
      },
      {
        p: 'La primera suscripción de cada profesional incluye 30 días corridos de prueba gratuita. Durante la prueba no se realiza ningún cobro; el primer débito se produce al finalizar. Si el profesional cancela la suscripción antes de que termine la prueba, no se le cobra. La prueba se otorga por única vez a cada profesional.',
      },
      { p: 'Quien vuelve a suscribirse después de cancelar o de una baja por falta de pago no recibe una nueva prueba.' },
      { h: 'Falta de pago y suspensión del perfil' },
      {
        p: `La falta de pago de la suscripción —ya sea por retraso, por fondos insuficientes, por tarjeta vencida o por cualquier otro rechazo del medio de pago— habilita a ${NAME} a suspender el perfil profesional, que deja de mostrarse en el directorio hasta que el pago se regularice.`,
      },
      {
        p: 'Si un cobro mensual es rechazado (por ejemplo, por fondos insuficientes o tarjeta vencida), el perfil se oculta del directorio de inmediato y se avisa al email registrado. Mercado Pago reintenta el cobro automáticamente durante un período limitado; si alguno de los reintentos se aprueba, el perfil vuelve a publicarse. Si todos los reintentos fallan, la suscripción se cancela y el profesional puede volver a suscribirse desde el enlace que recibe por email.',
      },
      {
        p: 'El profesional puede cancelar su suscripción en cualquier momento desde su cuenta de Mercado Pago. La cancelación detiene los cobros futuros y oculta el perfil.',
      },
      { p: 'Los datos de la tarjeta o cuenta de pago los procesa Mercado Pago. Este sitio no los recibe ni los almacena.' },
      { h: 'Cancelación de la suscripción' },
      {
        p: `El Profesional podrá cancelar su suscripción en ${NAME} en cualquier momento a través del panel de control de su cuenta o notificándolo mediante correo electrónico a ${SITE.contactEmail}.`,
      },
      {
        p: 'Efecto de la cancelación: La cancelación detendrá la renovación automática del siguiente ciclo de cobro. El Perfil Profesional permanecerá activo y visible en la Plataforma hasta la finalización del período previamente abonado (mensual), sin que ello genere derecho a devolución ni prorrateo del importe consumido.',
      },
    ],
  },
  {
    id: 'prohibiciones',
    title: '5. Prohibiciones',
    blocks: [
      {
        p: 'Está prohibido publicar información engañosa, ofrecer tratamientos prohibidos o promesas de resultados garantizados, o cualquier contenido contrario a las normas de ética de su profesión.',
      },
      {
        p: 'Está prohibido por el Código Penal de Argentina ejercer actos propios de una profesión que requiere una habilitación especial, sin tener el título o la autorización oficial.',
      },
    ],
  },
  {
    id: 'responsabilidad',
    title: '6. Limitación de responsabilidad',
    blocks: [
      {
        p: `${NAME} NO garantiza la cantidad de consultas que recibirá un perfil. NO responde por la calidad de la atención brindada por los profesionales, por los acuerdos entre estos y las personas que los consultan. NO responde por interrupciones del servicio profesional ajenas a su control.`,
      },
    ],
  },
  {
    id: 'modificacion',
    title: '7. Modificación',
    blocks: [
      {
        p: `${NAME} se reserva el derecho, a su entera discreción, de modificar el Sitio, los Servicios y estos Términos en cualquier momento y sin previo aviso. Si modificamos estos Términos, publicaremos la modificación en el Sitio o le notificaremos dicha modificación. También actualizaremos la fecha de "Última actualización" que aparece al inicio de estos Términos. Al continuar accediendo o utilizando el Sitio o los Servicios después de que hayamos publicado una modificación en el Sitio o le hayamos notificado dicha modificación, usted indica que acepta regirse por los Términos modificados. Si los Términos modificados no le resultan aceptables, su único recurso es dejar de utilizar el Sitio y los Servicios.`,
      },
    ],
  },
  {
    id: 'elegibilidad',
    title: '8. Elegibilidad',
    blocks: [
      {
        p: 'El Sitio y los Servicios están destinados exclusivamente a personas mayores de 13 años. Queda expresamente prohibido el acceso o uso del Sitio o los Servicios por parte de menores de 13 años. Al acceder o utilizar el Sitio o los Servicios, usted declara y garantiza que tiene 13 años o más.',
      },
    ],
  },
];

/** II. POLÍTICAS DE PRIVACIDAD */
const PRIVACY: Section[] = [
  {
    id: 'privacidad-datos',
    title: '1. Recopilación y Uso de sus Datos Personales',
    blocks: [
      { h: 'a. Datos Personales de los profesionales' },
      { p: 'Podemos solicitar información como:' },
      {
        list: [
          'Correo electrónico',
          'Nombre y apellido',
          'DNI, CUIT',
          'Dirección, Estado/Provincia, Código Postal, Ciudad',
          'Teléfono',
          'Profesión',
          'Especialidades',
          'Corrientes',
          'Rango etario que atiende',
          'Modalidad de Atención (online, presencial, ambas)',
          'Obras sociales',
          'Número de matrícula',
          'Fotografía (opcional)',
          'Redes sociales y WhatsApp (opcional)',
        ],
      },
      { p: 'Sólo los usa el equipo de ProfesionalesOk para verificar la habilitación y comunicarse con el profesional:' },
      { list: ['Correo electrónico'] },
      {
        p: 'Si se solicita, el DNI o CUIT se usa únicamente para consultar el padrón oficial de matrículas y no se almacena ni se muestra.',
      },
      { h: 'b. Datos de las personas que visitan el sitio' },
      {
        p: 'Sólo guardamos el nombre, el email y el mensaje que envían por el formulario de contacto, para responderlos. ProfesionalesOk no pide ni guarda información sobre la salud de quienes lo visitan.',
      },
      { p: 'La consulta con el profesional ocurre fuera del sitio, por Whatsapp o por el medio que el profesional ofrezca.' },
    ],
  },
  {
    id: 'privacidad-uso',
    title: '2. Datos de Uso',
    blocks: [{ p: 'Se recopilan automáticamente (IP, tipo/versión de navegador, páginas visitadas, fecha/hora, duración, identificadores de dispositivo).' }],
  },
  {
    id: 'privacidad-cookies',
    title: '3. Tecnologías de Seguimiento y Cookies',
    blocks: [{ p: 'Usamos Cookies y tecnologías similares para rastrear actividad y almacenar información.' }],
  },
  {
    id: 'privacidad-usos',
    title: '4. Uso de sus Datos Personales',
    blocks: [
      {
        list: [
          'Proveer y mantener el Servicio, incluido su monitoreo.',
          'Gestionar su Cuenta, registro y acceso.',
          'Ejecución de contratos de productos/servicios adquiridos.',
          'Contactarlo por medios electrónicos.',
          'Gestionar sus solicitudes.',
        ],
      },
    ],
  },
  {
    id: 'privacidad-retencion',
    title: '5. Retención de sus Datos Personales',
    blocks: [{ p: 'Conservamos datos solo el tiempo necesario para los fines descritos.' }],
  },
  {
    id: 'privacidad-divulgacion',
    title: '6. Divulgación de sus Datos Personales',
    blocks: [
      { h: 'Transacciones Comerciales' },
      { p: 'En fusiones, adquisiciones o ventas de activos, sus datos pueden transferirse.' },
      { h: 'Cumplimiento de la Ley' },
      { p: 'Podemos divulgar datos si la ley lo exige o ante requerimientos de autoridades.' },
    ],
  },
  {
    id: 'privacidad-seguridad',
    title: '7. Seguridad de su información',
    blocks: [
      {
        p: 'Tomamos medidas para garantizar que su información se trate de forma segura y de acuerdo con esta Política de Privacidad. Lamentablemente, ningún sistema es 100% seguro, y no podemos garantizar la seguridad de la información que nos proporcione. Hemos implementado las medidas de seguridad necesarias para proteger su información personal. En la medida en que lo permita la ley aplicable, no nos hacemos responsables de la divulgación no autorizada.',
      },
      {
        p: 'Al utilizar nuestros Servicios o proporcionarnos información personal, usted acepta que podamos comunicarnos con usted electrónicamente sobre cuestiones de seguridad, privacidad y administrativas relacionadas con su uso de nuestros Servicios. Si detectamos una brecha de seguridad en nuestro sistema, intentaremos notificarle electrónicamente mediante un aviso por correo electrónico.',
      },
    ],
  },
  {
    id: 'privacidad-contacto',
    title: '8. Contáctenos',
    blocks: [{ p: `Correo: ${SITE.contactEmail}` }],
  },
];

const hasPlaceholders = [LEGAL.operator, LEGAL.cuit, LEGAL.address, LEGAL.taxes, LEGAL.price].some((x) => x.startsWith('['));

function Render({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        'h' in b ? (
          <h3 key={i} className="mt-6 text-base font-semibold">{b.h}</h3>
        ) : 'list' in b ? (
          <ul key={i} className="mt-3 list-disc space-y-1 pl-6 leading-relaxed text-ink-soft">
            {b.list.map((li) => <li key={li}>{li}</li>)}
          </ul>
        ) : (
          <p key={i} className="mt-3 leading-relaxed text-ink-soft">{b.p}</p>
        ),
      )}
    </>
  );
}

export default function TerminosPage() {
  return (
    <>
      <PageHeader
        title="Términos y condiciones"
        intro={`Y políticas de privacidad · Última actualización: ${TERMS_UPDATED} · Versión ${TERMS_VERSION}`}
        tone="text-lime"
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[280px_1fr]">
        <nav aria-label="Índice" className="hidden h-fit lg:sticky lg:top-24 lg:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">I. Términos y condiciones</p>
          <ul className="space-y-1 border-l border-ink/15 pl-4 text-sm">
            {TERMS.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="block py-1 text-ink-soft transition hover:text-ink">{s.title}</a></li>
            ))}
          </ul>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-ink-soft">II. Políticas de privacidad</p>
          <ul className="space-y-1 border-l border-ink/15 pl-4 text-sm">
            {PRIVACY.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="block py-1 text-ink-soft transition hover:text-ink">{s.title}</a></li>
            ))}
          </ul>
        </nav>

        <div className="max-w-[72ch]">
          {hasPlaceholders && (
            <p role="note" className="mb-10 rounded-2xl bg-lime px-5 py-4 text-sm font-medium leading-relaxed">
              Faltan completar los datos entre corchetes (razón social, CUIT, domicilio, monto e impuestos): se cargan con las
              variables LEGAL_NAME, LEGAL_CUIT, LEGAL_ADDRESS, LEGAL_TAXES y MEMBERSHIP_PRICE_ARS antes de publicar el sitio.
            </p>
          )}

          <p className="mb-10 leading-relaxed text-ink-soft">
            Al acceder y utilizar este servicio, usted acepta y accede a estar obligado por los términos y disposiciones.
            Asimismo, al utilizar nuestro servicio particulares, usted estará sujeto a toda regla o guía de uso
            correspondiente que se haya publicado para dicho servicio. Toda participación en este servicio constituirá la
            aceptación de estos Términos y Condiciones, y Políticas de Privacidad. Si no acepta cumplir con lo anterior,
            por favor, no lo utilice.
          </p>

          <h2 className="mb-8 text-2xl font-semibold">I. Términos y condiciones</h2>
          {TERMS.map((s) => (
            <section key={s.id} id={s.id} className="mb-10 scroll-mt-24">
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <Render blocks={s.blocks} />
            </section>
          ))}

          <h2 className="mb-4 mt-16 text-2xl font-semibold">II. Políticas de privacidad</h2>
          <p className="mb-8 leading-relaxed text-ink-soft">
            Esta Política de Privacidad describe nuestras políticas y procedimientos sobre la recopilación, uso y
            divulgación de su información cuando utiliza el Servicio, y le informa sobre sus derechos de privacidad y cómo
            la ley lo protege. Usamos sus datos personales para proporcionar y mejorar el Servicio. Al utilizar el
            Servicio, usted acepta la recopilación y el uso de información de acuerdo con esta Política de Privacidad.
          </p>
          {PRIVACY.map((s) => (
            <section key={s.id} id={s.id} className="mb-10 scroll-mt-24">
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <Render blocks={s.blocks} />
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
