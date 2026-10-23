/**
 * Carga perfiles de DEMOSTRACIÓN (ficticios) para ver el directorio con datos: npm run db:seed
 * Es idempotente: si los perfiles ya existen, no los duplica.
 * Para borrarlos: DELETE FROM subscriptions WHERE ...; DELETE FROM professionals WHERE email LIKE 'demo+%@example.com';
 */
try {
  process.loadEnvFile('.env');
} catch {
  /* sin .env: se usan las variables del sistema */
}
import { getDb } from '../lib/db';
import { professionals, subscriptions } from '../db/schema';

type Demo = readonly [
  string, string, string, string, string, boolean, // nombre, apellido, profesión, localidad, matrícula, destacado
  { specialties: string[]; corrientes: string[]; ageGroups: string[]; modalidad: string; obrasSociales: string[] },
];
const DEMO: Demo[] = [
  ['Lucía', 'Fernández', 'psicologia', 'Reconquista', '4821', true, {
    specialties: ['Psicología clínica', 'Ansiedad y estrés'], corrientes: ['Cognitivo-conductual (TCC)'],
    ageGroups: ['adolescentes', 'adultos'], modalidad: 'AMBAS', obrasSociales: ['IAPOS (Santa Fe)', 'OSDE', 'Particular (sin obra social)'] }],
  ['Martín', 'Gómez', 'kinesiologia', 'Romang', '1177', true, {
    specialties: ['Traumatológica', 'Deportiva'], corrientes: [],
    ageGroups: ['adolescentes', 'adultos'], modalidad: 'PRESENCIAL', obrasSociales: ['PAMI', 'IAPOS (Santa Fe)'] }],
  ['Carolina', 'Ruiz', 'nutricion', 'Villa Ocampo', '0932', true, {
    specialties: ['Nutrición clínica', 'Nutrición infantil'], corrientes: [],
    ageGroups: ['ninos', 'adolescentes', 'adultos'], modalidad: 'ONLINE', obrasSociales: ['Particular (sin obra social)'] }],
  ['Julián', 'Acosta', 'odontologia', 'Reconquista', '2210', true, {
    specialties: ['Odontopediatría', 'Ortodoncia'], corrientes: [],
    ageGroups: ['ninos', 'adolescentes'], modalidad: 'PRESENCIAL', obrasSociales: ['IAPOS (Santa Fe)', 'Sancor Salud', 'Swiss Medical'] }],
  ['Sofía', 'Benítez', 'psicologia', 'Avellaneda', '5543', false, {
    specialties: ['Infancia y adolescencia', 'Terapia familiar'], corrientes: ['Sistémica', 'Psicoanalítica'],
    ageGroups: ['ninos', 'adolescentes'], modalidad: 'AMBAS', obrasSociales: ['Incluir Salud', 'Particular (sin obra social)'] }],
  ['Andrés', 'Molina', 'medicina', 'Villa Ocampo', '8120', false, {
    specialties: ['Clínica médica', 'Geriatría'], corrientes: [],
    ageGroups: ['adultos'], modalidad: 'PRESENCIAL', obrasSociales: ['PAMI', 'IAPOS (Santa Fe)', 'OSECAC (Empleados de Comercio)'] }],
  ['Valentina', 'Paz', 'fonoaudiologia', 'Reconquista', '0764', false, {
    specialties: ['Lenguaje infantil', 'Voz'], corrientes: [],
    ageGroups: ['ninos', 'adolescentes', 'adultos'], modalidad: 'AMBAS', obrasSociales: ['IAPOS (Santa Fe)'] }],
  ['Nicolás', 'Ibarra', 'terapia-ocupacional', 'Romang', '3391', false, {
    specialties: ['Neurodesarrollo y TEA', 'Integración sensorial'], corrientes: [],
    ageGroups: ['ninos'], modalidad: 'PRESENCIAL', obrasSociales: ['Incluir Salud', 'PAMI'] }],
];

async function main() {
  const db = getDb();
  let created = 0;
  for (const [i, [firstName, lastName, profession, city, lic, featured, extra]] of DEMO.entries()) {
    const email = `demo+${i + 1}@example.com`;
    const rows = await db
      .insert(professionals)
      .values({
        slug: `demo-${i + 1}-${lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`,
        email,
        firstName,
        lastName,
        phone: `549341000${String(i + 1).padStart(4, '0')}`,
        profession,
        licenseType: 'MP',
        licenseNumber: lic,
        licenseProvince: 'Santa Fe',
        city,
        province: 'Santa Fe',
        bio: 'Perfil de demostración.',
        ...extra,
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
        status: 'ACTIVE',
        isFeatured: featured,
        termsAcceptedAt: new Date(),
        termsVersion: 'demo',
      })
      .onConflictDoNothing({ target: professionals.email })
      .returning({ id: professionals.id });

    if (rows[0]) {
      created++;
      await db.insert(subscriptions).values({
        professionalId: rows[0].id,
        mpPreapprovalId: `mock_demo_${i + 1}`,
        status: 'AUTHORIZED',
        amount: '15000',
      });
    }
  }
  console.log(created ? `Se crearon ${created} perfiles de demostración.` : 'Los perfiles de demostración ya existían.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
