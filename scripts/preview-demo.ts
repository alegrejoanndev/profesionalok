/** Datos de ejemplo del directorio, para que la vista previa estática pueda filtrar. Lo usa build-preview.py. */
import { searchProfessionals } from '../lib/professionals';

async function main() {
  const r = (await searchProfessionals({} as never)) as unknown as { items?: Record<string, unknown>[] };
  const list = (r.items ?? (r as unknown as Record<string, unknown>[])) as Record<string, unknown>[];
  console.log(
    JSON.stringify(
      list.map((p) => ({ slug: p.slug, esp: p.specialties, corr: p.corrientes, obra: p.obrasSociales, edad: p.ageGroups, mod: p.modalidad, zona: p.city })),
    ),
  );
}
main();
