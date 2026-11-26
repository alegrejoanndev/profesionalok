import type { MatriculaResult, MatriculaStatusValue } from './matricula';

/**
 * Verificación ANTES del pago. Qué resultados frenan el alta:
 *  - NOT_FOUND / MISMATCH / NOT_ENABLED → la matrícula no figura, no coincide o no está habilitada: no se avanza al pago.
 *  - UNAVAILABLE (el padrón no respondió): frena, para que no se pueda avanzar con datos sin comprobar.
 *    Con MATRICULA_ON_UNAVAILABLE="allow" no frena y el perfil queda oculto hasta que una persona lo revise.
 *  - NOT_CHECKED (matrícula de otra provincia, o validación apagada) → NO se frena: la verifica el equipo antes de publicar.
 */
export const BLOCKING: readonly MatriculaStatusValue[] = ['NOT_FOUND', 'MISMATCH', 'NOT_ENABLED'];

export const isBlocking = (status: MatriculaStatusValue) =>
  BLOCKING.includes(status) || (status === 'UNAVAILABLE' && (process.env.MATRICULA_ON_UNAVAILABLE ?? 'block').toLowerCase() !== 'allow');

/** Mensaje para mostrar a la persona. Es genérico a propósito: nunca incluye datos del registro oficial. */
export function gateMessage(status: MatriculaStatusValue, note?: string): string {
  if (note === 'other_province') {
    return 'Tu matrícula es de otra provincia, así que no la podemos consultar automáticamente. Podés continuar: una persona del equipo verificará tus datos antes de publicar tu perfil.';
  }
  switch (status) {
    case 'VERIFIED':
      return 'Tu matrícula figura en el padrón oficial y los datos coinciden.';
    case 'NOT_FOUND':
      return 'No encontramos esa matrícula en el padrón oficial. Revisá el número de matrícula y la provincia. Si tu matrícula es de otra provincia, elegila en el campo correspondiente.';
    case 'MISMATCH':
      return 'La matrícula figura en la lista del Colegio, pero el nombre o el apellido no coinciden. Revisalos tal como figuran en el Colegio.';
    case 'NOT_ENABLED':
      return 'La matrícula figura en el padrón, pero hoy no está habilitada. Si es un error, regularizá tu situación en tu colegio o ministerio de salud.';
    case 'UNAVAILABLE':
      return isBlocking(status)
        ? 'No pudimos consultar el padrón del Colegio en este momento. Probá de nuevo en unos minutos.'
        : 'No pudimos consultar el padrón en este momento. Podés continuar: una persona del equipo verificará tu matrícula antes de publicar tu perfil.';
    default:
      return 'Una persona del equipo verificará tu matrícula contra el padrón antes de publicar tu perfil.';
  }
}

export function gateResponse(r: MatriculaResult) {
  return { status: r.status, blocking: isBlocking(r.status), message: gateMessage(r.status, r.note), note: r.note ?? null };
}
