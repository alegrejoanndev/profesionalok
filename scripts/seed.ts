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
  ['Martín', 'Gómez', 'psicologia', 'Romang', '1177', true, {
    specialties: ['Adolescencias', 'Adicciones'], corrientes: ['Gestalt', 'Humanista'],
    ageGroups: ['adolescentes', 'adultos'], modalidad: 'PRESENCIAL', obrasSociales: ['PAMI', 'IAPOS (Santa Fe)'] }],
  ['Carolina', 'Ruiz', 'psicologia', 'Villa Ocampo', '0932', true, {
    specialties: ['Infancias', 'Terapia familiar'], corrientes: ['Sistémica'],
    ageGroups: ['ninos', 'adolescentes'], modalidad: 'ONLINE', obrasSociales: ['Particular (sin obra social)'] }],
  ['Julián', 'Acosta', 'psicologia', 'Reconquista', '2210', true, {
    specialties: ['Terapia de pareja', 'Duelo y pérdidas'], corrientes: ['Psicoanálisis lacaniano'],
    ageGroups: ['adultos'], modalidad: 'PRESENCIAL', obrasSociales: ['IAPOS (Santa Fe)', 'Sancor Salud', 'Swiss Medical'] }],
  ['Sofía', 'Benítez', 'psicologia', 'Avellaneda', '5543', false, {
    specialties: ['Infancias', 'Adolescencias', 'Psicopedagogía clínica'], corrientes: ['Psicoanalítica', 'Terapia de juego'],
    ageGroups: ['ninos', 'adolescentes'], modalidad: 'AMBAS', obrasSociales: ['Incluir Salud', 'Particular (sin obra social)'] }],
  ['Andrés', 'Molina', 'psicologia', 'Villa Ocampo', '8120', false, {
    specialties: ['Psicología clínica', 'Trauma y estrés postraumático'], corrientes: ['EMDR', 'Cognitivo-conductual (TCC)'],
    ageGroups: ['adultos'], modalidad: 'AMBAS', obrasSociales: ['PAMI', 'IAPOS (Santa Fe)', 'OSECAC (Empleados de Comercio)'] }],
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
