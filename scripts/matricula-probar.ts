/**
 * Prueba la conexión con el registro oficial (REFEPS / SISA) y muestra la respuesta CRUDA.
 * Sirve para confirmar que las credenciales funcionan y que la respuesta se interpreta bien,
 * antes de activar MATRICULA_MODE="refeps".
 *
 *   npm run matricula:probar -- --dni 12345678
 *   npm run matricula:probar -- --apellido Perez --matricula 4821
 *   npm run matricula:probar -- --dni 12345678 --nombre Ana --apellido Perez --matricula 4821 --profesion psicologia --provincia "Santa Fe"
 *
 * Las dos últimas formas, con todos los datos, también muestran el veredicto del sistema.
 */
try {
  process.loadEnvFile('.env');
} catch {
  /* sin .env */
}
import { evaluateRecords, parseSisaResponse, sisaGet } from '../lib/matricula';

const args: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1] ?? '';
}

async function main() {
  if (!process.env.SISA_USER || !process.env.SISA_PASSWORD) {
    console.error('\n✘ Faltan SISA_USER y SISA_PASSWORD en el archivo .env.');
    console.error('  Son las credenciales de servicios web del SISA (https://sisa.msal.gov.ar).\n');
    process.exit(1);
  }
  const endpoint = args.dni || args.codigo ? 'obtener' : 'buscar';
  const params: Record<string, string> = args.dni
    ? { nrodoc: args.dni }
    : args.codigo
      ? { codigo: args.codigo }
      : { apellido: args.apellido ?? '', matricula: args.matricula ?? '' };
  if (!args.dni && !args.codigo && (!args.apellido || !args.matricula)) {
    console.error('Uso: npm run matricula:probar -- --dni 12345678\n     npm run matricula:probar -- --apellido Perez --matricula 4821');
    process.exit(1);
  }

  console.log(`Consultando /profesional/${endpoint} …`);
  const res = await sisaGet(endpoint, params);
  if (!res.ok) {
    console.error(`\n✘ ${res.reason}\n`);
    process.exit(1);
  }
  console.log('\n── Respuesta cruda ──────────────────────────');
  console.log(JSON.stringify(res.json, null, 2));

  const records = parseSisaResponse(res.json);
  console.log('\n── Cómo la interpreta el sistema ─────────────');
  console.log(JSON.stringify(records, null, 2));
  if (records.length === 0) console.log('\n⚠ No se pudo leer ningún profesional. Si la respuesta de arriba tiene datos, avisá: hay que ajustar la lectura en lib/matricula.ts (parseSisaResponse).');

  if (args.nombre && args.apellido && args.matricula && args.profesion && args.provincia) {
    const verdict = evaluateRecords(records, {
      firstName: args.nombre,
      lastName: args.apellido,
      profession: args.profesion,
      licenseNumber: args.matricula,
      licenseProvince: args.provincia,
    });
    console.log('\n── Veredicto ─────────────────────────────────');
    console.log(verdict);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
