/**
 * Pruebas de la validación de matrículas:  npm run test:matricula
 *
 *  1. Comparación de datos (nombre, matrícula, profesión, provincia, estado): casos normales y de suplantación.
 *  2. Lectura de respuestas de SISA con distintas formas.
 *  3. Padrón del Colegio de Psicólogos de Santa Fe (CPSF) contra una página falsa local: lectura del HTML,
 *     coincidencias, otra provincia, caídas del sitio.
 *  4. Consulta real por HTTP a un "SISA falso" local: credenciales, DNI, búsqueda por apellido,
 *     tiempos de espera y errores. NO usa el registro oficial ni necesita credenciales ni base de datos.
 */
import http from 'node:http';
import { gateResponse } from '../lib/matricula-gate';
import { parseCpsfHtml, resetCpsfCache } from '../lib/cpsf';
import {
  cpsfNameMatches,
  evaluateRecords,
  licenseMatches,
  parseSisaResponse,
  surnameMatches,
  validateMatricula,
  type MatriculaInput,
  type RegistryRecord,
} from '../lib/matricula';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m'} ${name}${!ok && detail ? `  →  ${detail}` : ''}`);
}

const ana: MatriculaInput = { firstName: 'Ana', lastName: 'Pérez', profession: 'psicologia', licenseNumber: '4821', licenseProvince: 'Santa Fe' };
const rec = (over: Partial<RegistryRecord> = {}, mat: Partial<RegistryRecord['matriculas'][number]> = {}): RegistryRecord => ({
  apellido: 'PEREZ',
  nombre: 'ANA MARIA',
  codigo: '1234',
  matriculas: [{ numero: '4821', profesion: 'Psicólogo', provincia: 'Santa Fe', habilitada: true, ...mat }],
  ...over,
});

// ───────────── Servidor SISA falso ─────────────
const requests: URL[] = [];
const personAna = {
  resultado: 'OK', apellido: 'PEREZ', nombre: 'ANA MARIA', codigo: '1234',
  matricula: [{ matricula: '4821', profesion: 'Psicólogo', provincia: 'Santa Fe', estado: 'Habilitada' }],
};
const sisa = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  requests.push(url);
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.searchParams.get('usuario') !== 'test' || url.searchParams.get('clave') !== 'secreto') return send(401, { resultado: 'Usuario o clave incorrectos' });

  const dni = url.searchParams.get('nrodoc');
  const code = url.searchParams.get('codigo');
  const apellido = url.searchParams.get('apellido');
  const endpoint = url.pathname.split('/').pop();

  if (endpoint === 'obtener') {
    if (dni === '11111111' || code === '1234') return send(200, { Profesional: personAna });
    if (dni === '22222222') return send(200, { Profesional: { ...personAna, apellido: 'GOMEZ', nombre: 'LUIS', codigo: '9999' } }); // DNI de otra persona
    if (dni === '44444444') return send(500, { error: 'boom' });
    return send(200, { Profesional: { resultado: 'NO SE ENCONTRARON RESULTADOS' } });
  }
  if (endpoint === 'buscar') {
    if (apellido === 'Pérez' || apellido === 'Perez') return send(200, { Profesional: [personAna] }); // forma de lista
    if (apellido === 'Suspendida') return send(200, { Profesional: { apellido: 'SUSPENDIDA', nombre: 'ANA', matricula: [{ matricula: '777', profesion: 'Psicólogo', provincia: 'Santa Fe', estado: 'No habilitada' }] } });
    if (apellido === 'Lenta') return void setTimeout(() => send(200, {}), 1500);
    return send(200, { Profesional: { resultado: 'NO SE ENCONTRARON RESULTADOS' } });
  }
  send(404, {});
});

async function main() {
  // ═════════ 1. Comparación ═════════
  console.log('Comparación de datos');
  let r = evaluateRecords([rec()], ana);
  check('todo coincide → VERIFIED con código federal', r.status === 'VERIFIED' && r.refepsCode === '1234', JSON.stringify(r));
  check('tildes, mayúsculas y nombre compuesto no molestan', evaluateRecords([rec()], { ...ana, firstName: 'ANA', lastName: 'pérez' }).status === 'VERIFIED');
  check('apellido compuesto: "García López" = "GARCIA LOPEZ"', surnameMatches('García López', 'GARCIA LOPEZ'));
  check('"Pérez" no coincide con "Gómez"', !surnameMatches('Pérez', 'Gómez'));
  check('matrícula con ceros o prefijo: 04821 / MP 4821 / M.P. 4821', ['04821', 'MP 4821', 'M.P. 4821'].every((m) => licenseMatches('4821', m)));
  check('"4821" no coincide con "48210" ni "14821"', !licenseMatches('4821', '48210') && !licenseMatches('4821', '14821'));
  check('CABA y "Ciudad Autónoma de Buenos Aires" son lo mismo', evaluateRecords([rec({}, { provincia: 'CABA' })], { ...ana, licenseProvince: 'Ciudad Autónoma de Buenos Aires' }).status === 'VERIFIED');

  console.log('\nSuplantación y datos que no coinciden');
  r = evaluateRecords([rec({ apellido: 'GOMEZ', nombre: 'LUIS' })], ana);
  check('matrícula de OTRA persona → MISMATCH (no se aprueba)', r.status === 'MISMATCH', JSON.stringify(r));
  check('nombre de pila distinto con el mismo apellido → no coincide', evaluateRecords([rec({ nombre: 'JUAN CARLOS' })], ana).status !== 'VERIFIED');
  check('otra profesión → MISMATCH', evaluateRecords([rec({}, { profesion: 'Odontólogo' })], ana).status === 'MISMATCH');
  check('otra provincia → MISMATCH', evaluateRecords([rec({}, { provincia: 'Córdoba' })], ana).status === 'MISMATCH');
  check('matrícula NO habilitada → NOT_ENABLED', evaluateRecords([rec({}, { habilitada: false })], ana).status === 'NOT_ENABLED');
  check('estado desconocido → no se aprueba', evaluateRecords([rec({}, { habilitada: null })], ana).status === 'MISMATCH');
  check('registro vacío → NOT_FOUND', evaluateRecords([], ana).status === 'NOT_FOUND');
  check('la persona existe pero con otra matrícula → NOT_FOUND', evaluateRecords([rec({}, { numero: '9999' })], ana).status === 'NOT_FOUND');
  check('varias matrículas: elige la correcta', evaluateRecords([rec({ matriculas: [
    { numero: '4821', profesion: 'Médico', provincia: 'Córdoba', habilitada: true },
    { numero: '4821', profesion: 'Psicólogo', provincia: 'Santa Fe', habilitada: true },
  ] })], ana).status === 'VERIFIED');

  // ═════════ 2. Lectura de respuestas ═════════
  console.log('\nLectura de la respuesta de SISA');
  check('objeto único', parseSisaResponse({ Profesional: personAna }).length === 1);
  check('lista de profesionales', parseSisaResponse({ Profesional: [personAna, personAna] }).length === 2);
  check('una sola matrícula como objeto (no lista)', parseSisaResponse({ Profesional: { ...personAna, matricula: personAna.matricula[0] } })[0].matriculas.length === 1);
  check('campos en mayúsculas/minúsculas distintas', parseSisaResponse({ profesional: { Apellido: 'PEREZ', Nombre: 'ANA', Matricula: [{ Matricula: '1', Profesion: 'Psicólogo', Provincia: 'Santa Fe', Estado: 'HABILITADA' }] } })[0].matriculas[0].habilitada === true);
  check('"No habilitada" se lee como false (no como true)', parseSisaResponse({ Profesional: { apellido: 'X', nombre: 'Y', matricula: [{ matricula: '1', estado: 'No habilitada' }] } })[0].matriculas[0].habilitada === false);
  check('respuesta sin resultados → lista vacía', parseSisaResponse({ Profesional: { resultado: 'NO SE ENCONTRARON RESULTADOS' } }).length === 0);
  check('basura (null, texto) no rompe', parseSisaResponse(null).length === 0 && parseSisaResponse('x').length === 0);

  // ═════════ 3. Consulta HTTP ═════════
  await new Promise<void>((ok) => sisa.listen(4020, ok));
  Object.assign(process.env, { MATRICULA_MODE: 'refeps', SISA_USER: 'test', SISA_PASSWORD: 'secreto', SISA_API_URL: 'http://localhost:4020', SISA_TIMEOUT_MS: '400' });

  console.log('\nConsulta al registro (SISA falso por HTTP)');
  requests.length = 0;
  let v = await validateMatricula({ ...ana, dni: '11111111' });
  check('con DNI correcto → VERIFIED por DNI', v.status === 'VERIFIED' && v.method === 'dni' && v.source === 'REFEPS', JSON.stringify(v));
  const q = requests[0];
  check('envía usuario, clave y nrodoc a /profesional/obtener', q?.pathname.endsWith('/profesional/obtener') && q.searchParams.get('nrodoc') === '11111111' && q.searchParams.get('usuario') === 'test');
  check('con DNI hace UNA sola consulta (no busca por nombre)', requests.length === 1);

  requests.length = 0;
  v = await validateMatricula({ ...ana, dni: '22222222' });
  check('DNI de OTRA persona → no se aprueba', v.status !== 'VERIFIED', JSON.stringify(v));
  check('…y NO cae a buscar por nombre (evita la suplantación)', requests.every((x) => !x.pathname.endsWith('/buscar')));

  requests.length = 0;
  v = await validateMatricula({ ...ana, dni: '33333333' });
  check('DNI que no está en el registro → no se aprueba por nombre', v.status !== 'VERIFIED' && requests.every((x) => !x.pathname.endsWith('/buscar')), JSON.stringify(v));

  v = await validateMatricula({ ...ana, dni: '44444444' });
  check('error del servicio con DNI → UNAVAILABLE (revisión manual)', v.status === 'UNAVAILABLE', JSON.stringify(v));

  v = await validateMatricula(ana);
  check('sin DNI → busca por apellido + matrícula', v.status === 'VERIFIED' && v.method === 'name', JSON.stringify(v));
  check('…pero la identidad es "débil" (method name): no alcanza para aprobar solo', v.method === 'name');

  v = await validateMatricula({ ...ana, refepsCode: '1234' });
  check('con código federal ya verificado → VERIFIED sin pedir DNI', v.status === 'VERIFIED' && v.method === 'code', JSON.stringify(v));

  v = await validateMatricula({ firstName: 'Ana', lastName: 'Suspendida', profession: 'psicologia', licenseNumber: '777', licenseProvince: 'Santa Fe' });
  check('matrícula suspendida → NOT_ENABLED', v.status === 'NOT_ENABLED', JSON.stringify(v));

  v = await validateMatricula({ ...ana, lastName: 'Desconocida' });
  check('apellido que no figura → NOT_FOUND', v.status === 'NOT_FOUND', JSON.stringify(v));

  v = await validateMatricula({ ...ana, lastName: 'Lenta' });
  check('si el registro tarda más del límite → UNAVAILABLE (no se cuelga el alta)', v.status === 'UNAVAILABLE', JSON.stringify(v));

  process.env.SISA_PASSWORD = 'mala';
  v = await validateMatricula({ ...ana, dni: '11111111' });
  check('credenciales inválidas → UNAVAILABLE con motivo claro', v.status === 'UNAVAILABLE' && /credenciales/i.test(v.detail), JSON.stringify(v));
  check('el mensaje de error NO contiene la clave ni el DNI', !/mala|11111111/.test(JSON.stringify(v)));
  process.env.SISA_PASSWORD = 'secreto';


  // ═════════ 3b. Padrón del Colegio de Psicólogos de Santa Fe (CPSF) ═════════
  console.log('\nPadrón del Colegio de Psicólogos de Santa Fe');
  const filas = Array.from({ length: 60 }, (_, i) => {
    const n = i + 1;
    if (n === 1234 % 60 + 1) return null; // (se reemplaza abajo)
    return [String(n), `APELLIDO${n} NOMBRE${n}`, 'Rosario', '', 'OSDE'];
  });
  const especiales: Record<number, string[]> = {
    7: ['1234', 'GÓMEZ, ANA MARÍA', 'Reconquista', '', 'OSDE'],
    8: ['0777', 'Suspendida Lucía', 'Rosario', 'Baja por solicitud', ''],
    9: ['0456', 'Benítez Martín', 'Avellaneda &amp; zona', '', ''],
  };
  const todas = filas.map((f, i) => especiales[i] ?? f ?? ['59', 'X Y', '', '', '']).map((r, i) => (i < 6 ? [String(i + 1), ...r.slice(1)] : r));
  const tablaHtml = (rows: string[][]) =>
    `<html><body><table class="table"><thead><tr><th>Mat. Nº</th><th>Apellido y Nombres</th><th>Localidad</th><th>Observación</th><th>O. Social</th></tr></thead><tbody>` +
    rows.map((r) => `<tr>${r.map((c) => `<td>${c.replace('á', '&aacute;')}</td>`).join('')}</tr>`).join('') +
    `</tbody></table><a href="/matriculados/25">siguiente</a></body></html>`;
  let cpsfHits = 0;
  const cpsfServer = http.createServer((req, res) => {
    cpsfHits++;
    const m = /\/matriculados(?:\/(\d+))?$/.exec(new URL(req.url ?? '/', 'http://x').pathname);
    if (!m) { res.statusCode = 404; return res.end('no'); }
    const offset = Number(m[1] ?? 0);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(tablaHtml(todas.slice(offset, offset + 25)));
  });
  await new Promise<void>((ok) => cpsfServer.listen(4021, ok));
  Object.assign(process.env, { MATRICULA_MODE: 'cpsf', CPSF_URL: 'http://localhost:4021/matriculados', CPSF_TIMEOUT_MS: '800' });
  resetCpsfCache();

  const filasLeidas = parseCpsfHtml(tablaHtml(todas.slice(0, 25)));
  check('lee las 25 filas de una página y descarta el encabezado', filasLeidas.length === 25 && filasLeidas[0].numero === '1', String(filasLeidas.length));
  check('decodifica acentos y entidades HTML', parseCpsfHtml(tablaHtml(todas.slice(0, 25))).length === 25 && parseCpsfHtml(tablaHtml([todas[9]]))[0].localidad === 'Avellaneda & zona');
  check('una página sin tabla → 0 filas (no rompe)', parseCpsfHtml('<html><body>Mantenimiento</body></html>').length === 0);
  check('nombre en cualquier orden: "Gómez, Ana María" ← Ana Gómez', cpsfNameMatches({ firstName: 'Ana', lastName: 'Gomez' }, 'GÓMEZ, ANA MARÍA'));
  check('nombre distinto no coincide', !cpsfNameMatches({ firstName: 'Lucía', lastName: 'Gomez' }, 'GÓMEZ, ANA MARÍA'));

  const gomez: MatriculaInput = { firstName: 'Ana María', lastName: 'Gómez', profession: 'psicologia', licenseNumber: '1234', licenseProvince: 'Santa Fe' };
  v = await validateMatricula(gomez);
  check('Santa Fe, matrícula y nombre coinciden → VERIFIED (fuente CPSF)', v.status === 'VERIFIED' && v.source === 'CPSF' && v.method === 'name', JSON.stringify(v));
  check('…y la identidad es "débil" (por nombre): la aprobación final la hace una persona', v.method === 'name');
  const hitsTrasPrimera = cpsfHits;
  check('el padrón se leyó completo (3 páginas con datos + 1 vacía)', hitsTrasPrimera >= 3, String(hitsTrasPrimera));
  await validateMatricula(gomez);
  check('la segunda consulta usa la copia en memoria (sin volver a pedir páginas)', cpsfHits === hitsTrasPrimera, `${cpsfHits} vs ${hitsTrasPrimera}`);

  v = await validateMatricula({ ...gomez, licenseNumber: '01234' });
  check('"01234" coincide con "1234"', v.status === 'VERIFIED', JSON.stringify(v));
  v = await validateMatricula({ ...gomez, licenseNumber: '99999' });
  check('matrícula que no figura → NOT_FOUND', v.status === 'NOT_FOUND', JSON.stringify(v));
  check('…y el alta queda BLOQUEADA (ya no deja continuar con cualquier dato)', gateResponse(v).blocking === true);
  v = await validateMatricula({ ...gomez, lastName: 'Pérez' });
  check('matrícula de otra persona → MISMATCH y bloquea', v.status === 'MISMATCH' && gateResponse(v).blocking === true, JSON.stringify(v));
  v = await validateMatricula({ firstName: 'Lucía', lastName: 'Suspendida', profession: 'psicologia', licenseNumber: '777', licenseProvince: 'Santa Fe' });
  check('observación "Baja" → NOT_ENABLED y bloquea', v.status === 'NOT_ENABLED' && gateResponse(v).blocking === true, JSON.stringify(v));

  const antes = cpsfHits;
  v = await validateMatricula({ ...gomez, licenseNumber: '555555', licenseProvince: 'Córdoba' });
  check('matrícula de OTRA provincia → se puede continuar (NOT_CHECKED, no bloquea)', v.status === 'NOT_CHECKED' && v.note === 'other_province' && gateResponse(v).blocking === false, JSON.stringify(v));
  check('…y no se consulta el padrón de Santa Fe', cpsfHits === antes);
  check('…con un mensaje que explica que lo verifica el equipo', /otra provincia/i.test(gateResponse(v).message) && /equipo/i.test(gateResponse(v).message));

  // El sitio del Colegio no responde
  cpsfServer.close();
  resetCpsfCache();
  process.env.CPSF_URL = 'http://localhost:4021/matriculados';
  v = await validateMatricula(gomez);
  check('el sitio del Colegio no responde → UNAVAILABLE y bloquea (no se avanza sin comprobar)', v.status === 'UNAVAILABLE' && gateResponse(v).blocking === true, JSON.stringify(v));
  process.env.MATRICULA_ON_UNAVAILABLE = 'allow';
  check('con MATRICULA_ON_UNAVAILABLE="allow" no bloquea (queda para revisión manual)', gateResponse(v).blocking === false);
  delete process.env.MATRICULA_ON_UNAVAILABLE;
  v = await validateMatricula({ ...gomez, licenseProvince: 'Entre Ríos' });
  check('caída del Colegio + otra provincia → igual se puede continuar', v.status === 'NOT_CHECKED' && gateResponse(v).blocking === false);
  resetCpsfCache();

  console.log('\nModos de funcionamiento');
  process.env.MATRICULA_MODE = 'mock';
  check('mock: empieza con 9 → verificada', (await validateMatricula({ ...ana, licenseNumber: '9100' })).status === 'VERIFIED');
  check('mock: empieza con 0 → no habilitada', (await validateMatricula({ ...ana, licenseNumber: '0100' })).status === 'NOT_ENABLED');
  check('mock: otra → no encontrada', (await validateMatricula({ ...ana, licenseNumber: '4100' })).status === 'NOT_FOUND');
  process.env.MATRICULA_MODE = 'off';
  check('off: no consulta nada (NOT_CHECKED)', (await validateMatricula(ana)).status === 'NOT_CHECKED');
  process.env.MATRICULA_MODE = 'refeps';
  delete process.env.SISA_USER;
  check('refeps sin credenciales → se comporta como off (no se rompe)', (await validateMatricula(ana)).status === 'NOT_CHECKED');
  process.env.SISA_USER = 'test';
  const prevEnv = process.env.NODE_ENV;
  Object.assign(process.env, { MATRICULA_MODE: 'mock', NODE_ENV: 'production' });
  check('mock está BLOQUEADO en producción (no aprueba matrículas falsas)', (await validateMatricula({ ...ana, licenseNumber: '9100' })).status === 'NOT_CHECKED');
  Object.assign(process.env, { NODE_ENV: prevEnv });
}

main()
  .catch((e) => {
    console.error('\nLa prueba no pudo completarse:', e);
    failed++;
  })
  .finally(() => {
    sisa.close();
    console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed} pruebas correctas, ${failed} con error\x1b[0m`);
    process.exit(failed === 0 ? 0 : 1);
  });
