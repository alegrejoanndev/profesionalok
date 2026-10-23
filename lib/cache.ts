import { revalidatePath } from 'next/cache';

/** Hace que el Inicio y el directorio reflejen un cambio al instante (sin esperar el revalidate). */
export function refreshPublicPages() {
  try {
    revalidatePath('/');
    revalidatePath('/profesionales');
  } catch {
    /* fuera de un request de Next (ej: scripts de prueba) no hay caché que invalidar */
  }
}
