# ProfesionalesOk

**Directorio de profesionales de la salud con suscripción mensual y 1 mes gratis.** La matrícula se verifica contra el padrón oficial (REFEPS) **antes del pago**. Un perfil se publica solo si la matrícula está aprobada y la suscripción está al día. Si un débito automático de Mercado Pago falla, el perfil se oculta solo y el profesional recibe un mail para regularizarlo.

> profesionalesok.com.ar · *Todos en un solo lugar.*

![Inicio](docs/screenshots/inicio.png)

<p>
  <img src="docs/screenshots/directorio.png" alt="Directorio" width="49%">
  <img src="docs/screenshots/alta.png" alt="Alta de profesionales" width="49%">
</p>

## Qué incluye

| Página | Ruta |
|---|---|
| Inicio: buscador, destacados, propuesta de valor, testimonios | `/` |
| Directorio con filtros: profesión, especialidad, edad (niños / adolescentes / adultos), corriente, obra social, modalidad y varias localidades ("Romang, Villa Ocampo") | `/profesionales` |
| Alta en 3 pasos (datos + verificación contra el padrón → documentación → suscripción mensual) | `/asociar` |
| Contacto | `/contacto` |
| Términos legales (borrador a completar) | `/terminos` |
| Regularizar suscripción (link del mail de baja) | `/regularizar/<token>` |
| Panel interno: revisar títulos, destacar, suspender | `/admin` |
| Simulador de Mercado Pago (solo pruebas) | `/dev/mp-simulador` |
| Webhook de Mercado Pago | `/api/webhooks/mercadopago` |
| Chequeo periódico de matrículas (para un programador de tareas) | `/api/cron/revalidar` |

**Stack:** Next.js 15 (App Router) · React 19 · Tailwind CSS 3.4 · PostgreSQL con Drizzle ORM · Sharp · Zod · Mercado Pago (suscripciones) · Resend (emails).

## Empezar

Requiere **Node.js 20.12 o superior** (se recomienda la 22 LTS).

### Modo demo (sin base de datos, 2 minutos)

```bash
git clone https://github.com/TU-USUARIO/profesionalesok.git
cd profesionalesok
cp .env.example .env
npm install
npm run dev
```

Abrí http://localhost:3000. Se ven perfiles de ejemplo. En Windows también podés hacer doble clic en `INICIAR.bat`.

### Versión completa (alta, panel y cobros)

1. En `.env`, reemplazá la línea `DATABASE_URL=""` por
   `DATABASE_URL="postgresql://pro:pro@localhost:5432/profesionalesok"`.
   También definí `ADMIN_PASSWORD` con una contraseña larga.
2. Encendé la base de datos y preparala:
   ```bash
   docker compose up -d     # PostgreSQL local (o usá una base gratis de neon.tech)
   npm run setup            # crea las tablas y carga 8 perfiles de demostración
   npm run dev
   ```

Con `MP_MODE="mock"` (el valor por defecto) el pago se hace en un **simulador** y no hace falta una cuenta de Mercado Pago.

#### Recorrido para probarlo

1. En `/asociar` completá el alta. Probá elegir *Medicina*: aparecen los campos M.N. y R.E. En el paso 3 se ve **1 mes gratis**, "Hoy pagás $0" y la fecha del primer cobro.
2. Al tocar *Continuar* en el paso 1 aparece el cartel **"Antes de continuar"** (se verifica CONTRA el padrón). Si la matrícula no figura o no coincide **no se llega al pago**: podés *Corregir mis datos* o *Darme de baja*. **Verificación de matrícula (simulador):** con `MATRICULA_MODE="mock"`, una matrícula que **empieza con 9** y un DNI cualquiera se verifican y el perfil se aprueba solo; con **0** figura "no habilitada"; cualquier otra "no figura" y **frena el alta antes del pago**. El DNI o CUIT es obligatorio.
3. En el simulador de pagos tocá **1. Autorizar la suscripción**: empieza el mes gratis y el perfil se activa (sin ningún cobro). Si la matrícula quedó aprobada, ya aparece en el directorio.
4. Si no se aprobó sola, entrá a `/admin` (usuario `admin` y tu `ADMIN_PASSWORD`), abrí el título y tocá **Aprobar**.
5. Tocá **2. Cobrar (terminó la prueba)** para simular el primer cobro, o **Rechazar un cobro**: el perfil desaparece y el mail con el link para regularizar queda en `.emails/`.
6. Abrí ese link, pagá de nuevo y el perfil vuelve solo. Regularizar **no** da otro mes gratis.

## Mes gratis

- La **primera suscripción de cada profesional** incluye `TRIAL_MONTHS` meses gratis (por defecto 1; `0` lo desactiva). Se usa el parámetro `free_trial` de la API de suscripciones de Mercado Pago.
- El profesional carga su medio de pago pero **no se le cobra** durante la prueba. El primer débito ocurre al terminar. Si cancela antes, no paga nada (y el perfil se da de baja).
- El perfil se **activa al autorizarse la suscripción**, no al primer cobro (sin prueba, sí espera al primer cobro).
- **Por única vez**: la prueba se otorga una sola vez por profesional (y una matrícula no puede registrarse dos veces). Quien cancela o cae por falta de pago y vuelve a suscribirse no recibe otra prueba.

## Perfil, filtros y catálogos

Cada perfil informa: **profesión** (define la matrícula), **varias especialidades**, **corriente** (Psicología), **rango etario** (niños, adolescentes, adultos), **modalidad** (presencial, online o ambas), **obras sociales** (lista amplia + agregar otras) y una **foto opcional y redonda**: si no sube foto se muestra el logo.

Todas las listas están en `lib/catalog.ts`: para agregar una especialidad, corriente u obra social basta con sumarla ahí. El directorio se ordena alfabéticamente (no hay orden por destacados ni por valoración).

El buscador acepta **varias localidades** separadas por coma o " y " (`Romang, Villa Ocampo`) y sugiere las de los perfiles publicados.

Si actualizás una instalación existente, corré `npm run db:push` para crear las columnas nuevas.

## Verificación automática de matrículas

Consulta el **REFEPS** (Red Federal de Registros de Profesionales de la Salud, del SISA / Ministerio de Salud) y compara nombre, matrícula, profesión, provincia y estado (habilitada).

| Resultado | Qué pasa |
|---|---|
| Todo coincide **y el DNI coincide** | El perfil se aprueba solo (`AUTO_REFEPS`). |
| Coincide solo por nombre + matrícula (sin DNI) | Se registra, pero **lo aprueba una persona**. |
| No figura / datos que no coinciden / no habilitada | **El alta se frena antes del pago** (no se guarda el perfil ni se crea la suscripción). La persona puede corregir los datos, escribirnos o darse de baja. |
| El padrón no responde (o la validación automática está apagada) | El alta continúa y **una persona verifica** la matrícula en `/admin` antes de publicar. Un corte del servicio oficial no deja afuera a nadie. |

**Verificación previa al pago:** apenas se completan los datos, `POST /api/matricula/verificar` consulta el padrón (con límite de intentos y sin devolver datos del registro) y `/api/onboarding` vuelve a verificar en el servidor antes de guardar nada o crear el checkout.

**Por qué el DNI o CUIT:** el nombre y el número de matrícula son datos públicos. Sin otro dato, cualquiera podría registrarse con los datos de un profesional real y aprobarse solo. El DNI o CUIT (de un CUIT/CUIL se toma el DNI que contiene) se usa **solo para consultar** y no se guarda ni se muestra. Se puede cambiar la política con `MATRICULA_AUTO_APPROVE` (`dni` por defecto, `always`, `never`).

**Para activarlo con el registro real:**
1. Solicitá al SISA las credenciales de servicios web (https://sisa.msal.gov.ar; consultas del REFEPS: refeps@msal.gov.ar). Sin esas credenciales el servicio no responde.
2. Cargá `SISA_USER` y `SISA_PASSWORD` y poné `MATRICULA_MODE="refeps"`.
3. **Probalo antes de publicar:** `npm run matricula:probar -- --dni 12345678` muestra la respuesta cruda del registro y cómo la interpreta el sistema. La lectura está escrita según la documentación pública del SISA y es tolerante, pero hay que confirmarla con una respuesta real (puede requerir un ajuste menor en `parseSisaResponse`, en `lib/matricula.ts`).

**Revalidación periódica:** una matrícula puede suspenderse con el tiempo. `GET /api/cron/revalidar` (con `Authorization: Bearer $CRON_SECRET`) revisa hasta 25 perfiles aprobados por llamada. Si el registro informa que una matrícula **ya no está habilitada**, el perfil se oculta (`LICENSE_INVALID`), vuelve a revisión manual y el cobro no lo reactiva. Si el registro no responde, no cambia nada. Programalo una vez por día o semana (programador de tu hosting o cron-job.org):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/revalidar
```
En `/admin`, el botón **Verificar matrícula** repite la consulta de un perfil puntual.

## Link de suscripción de Mercado Pago

El sitio usa **por defecto el link `https://mpago.la/1TeHYiV`** (está en `lib/site.ts`, `paymentLink`): al terminar el alta, el profesional va a ese link para suscribirse. Para usar otro link, definí `MP_SUBSCRIPTION_LINK` en `.env`.

Con el link, el precio y el mes gratis los define el **plan** de ese link en tu panel (ponelo en `MP_LINK_HAS_TRIAL="false"` si no tiene prueba). Límites a tener en cuenta:
- Tiene que ser un link de **suscripción** (con cobro recurrente), no un link de pago único.
- El pago se asocia al profesional **por el email**: tiene que pagar con el mismo email con el que se registró. Si no coincide, el pago aparece en `/admin` como "sin vincular" y lo vinculás a mano.
- Sigue necesitando `MP_ACCESS_TOKEN` y el webhook configurado.

Alternativa más precisa: si dejás `MP_SUBSCRIPTION_LINK=""` (vacío) y cargás `MP_ACCESS_TOKEN`, el sitio crea **un checkout por profesional** con la API de Mercado Pago, y cada pago queda asociado sin ambigüedad a quien lo hizo.

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Las principales:

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Base PostgreSQL. Vacía = modo demo. |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Acceso a `/admin`. Sin contraseña el panel queda deshabilitado. |
| `MP_MODE` | `mock` (simulador) o `live` (Mercado Pago real). |
| `TRIAL_MONTHS` | Meses de prueba gratis (por defecto 1; 0 = sin prueba). |
| `MP_SUBSCRIPTION_LINK` | Opcional: otro link de suscripción (por defecto `https://mpago.la/1TeHYiV`; vacío = un checkout por profesional con la API). |
| `MATRICULA_MODE` | `off`, `mock` (simulador) o `refeps` (registro oficial). |
| `SISA_USER` / `SISA_PASSWORD` | Credenciales de servicios web del SISA (modo `refeps`). |
| `MATRICULA_AUTO_APPROVE` | `dni` (por defecto), `always` o `never`. |
| `CRON_SECRET` | Clave para `/api/cron/revalidar`. |
| `MP_ACCESS_TOKEN` | Credencial de Mercado Pago (modo `live`). |
| `MP_WEBHOOK_SECRET` | Clave de la firma de los webhooks de Mercado Pago. |
| `MEMBERSHIP_PRICE_ARS` | Precio mensual de la suscripción en pesos. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envío de emails. Sin la clave se guardan en `.emails/`. |

> **Nunca subas tu `.env` a GitHub.** Ya está excluido en `.gitignore`.

## Cómo se manejan los cobros

- El profesional paga una **suscripción mensual** con débito automático de Mercado Pago.
- Un perfil se publica solo si: **suscripción al día (o en prueba) + matrícula aprobada (automática o en `/admin`) + no eliminado**.
- **Cobro rechazado:** baja lógica inmediata (el perfil sale del directorio) y mail con link para regularizar.
- Mercado Pago reintenta el cobro hasta 4 veces en 10 días. Si un reintento sale bien, **el perfil vuelve solo**. Si falla el último, se cancela la suscripción y se avisa por mail.
- Una **suspensión manual** desde `/admin` nunca se revierte automáticamente.
- El webhook valida la firma `x-signature` y consulta el estado real a la API de Mercado Pago (no confía en el contenido del aviso). Es idempotente: un aviso repetido no genera cambios ni mails duplicados.

La política completa está en [`lib/billing.ts`](lib/billing.ts).

## Pruebas

```bash
npm run typecheck        # TypeScript
npm run test:matricula   # validación de matrículas contra un SISA falso (no necesita base de datos)
npm run test:webhook     # cobros, mes gratis, alta completa y modo enlace (necesita la base encendida)
npm test                 # las dos anteriores
```

`test:matricula` comprueba la comparación de datos (incluidos intentos de suplantación) y la consulta HTTP a un SISA falso: credenciales, DNI, tiempos de espera y errores. `test:webhook` levanta un Mercado Pago falso, arranca el sitio y le manda webhooks firmados: cobro rechazado, repetido, aprobado, último reintento, cancelación, mes gratis, suspensiones, alta completa con verificación, etc. Ambas se ejecutan automáticamente en GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Despliegue

- **Hosting:** necesita Node.js y PostgreSQL. Funciona en un VPS, Render, Railway, Fly.io, etc.
- **Archivos subidos:** las fotos y los títulos se guardan en `storage/` (disco local). En hosting **sin disco permanente** (Vercel, por ejemplo) se perderían: cambiá las 4 funciones de [`lib/storage.ts`](lib/storage.ts) por S3, Cloudflare R2 o Supabase Storage.
- **Webhook de Mercado Pago:** en *Tus integraciones → Webhooks* cargá `https://TU-DOMINIO/api/webhooks/mercadopago` y activá *Planes y suscripciones* y *Pagos*.

## Antes de publicar en producción

- [ ] `MP_MODE="live"`, credenciales y precio reales. Probar primero en el sandbox de Mercado Pago y confirmar: (1) que la suscripción con `free_trial` se crea y que el primer cobro se programa al terminar la prueba, y (2) los campos de `/authorized_payments/{id}` que lee `lib/billing.ts`.
- [ ] **Matrículas:** conseguir las credenciales del SISA, probar con `npm run matricula:probar` y recién entonces `MATRICULA_MODE="refeps"`. Programar `/api/cron/revalidar`. Mientras tanto (`off`) todo pasa por revisión manual.
- [ ] Si usás el link de suscripción: confirmar que es de suscripción recurrente y que el plan tiene el mes gratis.
- [ ] `ADMIN_PASSWORD` larga (o reemplazar el panel por un login real).
- [ ] Completar los datos entre [CORCHETES] de `/terminos` y **hacerlos revisar por un abogado** (datos de salud: Ley 25.326).
- [ ] Reemplazar los testimonios de ejemplo (`app/page.tsx`) por reales.
- [ ] Revisar `lib/professions.ts`: la nomenclatura de matrículas varía según colegio y provincia.
- [ ] Emails: cuenta de Resend con dominio verificado. Los envíos fallidos hoy solo se registran en el log (conviene una cola de reintentos).
- [ ] El límite de intentos (`lib/ratelimit.ts`) es en memoria: con varias instancias, usar Redis/Upstash.

## Diseño

Paleta y tipografías del moodboard de marca ([`lib/colors.ts`](lib/colors.ts)): aqua, menta y lima como protagonistas; lavanda y rosa para resaltar; gris institucional en el pie. **Poppins** para la interfaz, **Bebas Neue** para la marca y **Lora** para la voz cercana. El *sello* ondulado, motivo central de la marca, se genera por código ([`components/Seal.tsx`](components/Seal.tsx)).

## Estructura

```
app/            Páginas y rutas de la API
components/     Logotipo, navegación, buscador, tarjetas, formularios, sello
db/schema.ts    Tablas de la base de datos
lib/            Cobros, Mercado Pago, emails, validación, archivos
scripts/        Datos de demostración, chequeo de base, pruebas del webhook
docs/           Capturas de pantalla y guía para subir a GitHub
```

## Licencias de terceros

Las tipografías incluidas en `app/fonts/` (Poppins, Bebas Neue y Lora) se distribuyen bajo la [SIL Open Font License 1.1](https://openfontlicense.org). Los íconos son de [Lucide](https://lucide.dev) (ISC).

## Licencia

Este repositorio todavía no tiene una licencia: por defecto, **todos los derechos quedan reservados** y nadie más puede reutilizar el código. Si querés que otras personas puedan usarlo, agregá un archivo `LICENSE` (por ejemplo MIT, desde *Add file → Create new file → LICENSE* en GitHub).
