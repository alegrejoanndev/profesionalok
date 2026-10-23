import type { MatriculaResult, MatriculaStatusValue } from './matricula';

/**
 * Verificación ANTES del pago. Qué resultados frenan el alta:
 *  - NOT_FOUND / MISMATCH / NOT_ENABLED → la matrícula no figura, no coincide o no está habilitada: no se avanza al pago.
 *  - UNAVAILABLE (el registro no respondió) y NOT_CHECKED (validación automática apagada) → NO se frena:
 *    una caída del servicio oficial no debe dejar afuera a nadie. El perfil queda oculto hasta que una persona
 *    del equipo lo revise.
 */
export const BLOCKING: readonly MatriculaStatusValue[] = ['NOT_FOUND', 'MISMATCH', 'NOT_ENABLED'];

export const isBlocking = (status: MatriculaStatusValue) => BLOCKING.includes(status);

/** Mensaje para mostrar a la persona. Es genérico a propósito: nunca incluye datos del registro oficial. */
export function gateMessage(status: MatriculaStatusValue): string {
  switch (status) {
    case 'VERIFIED':
      return 'Tu matrícula figura en el padrón oficial y los datos coinciden.';
    case 'NOT_FOUND':
      return 'No encontramos esa matrícula en el padrón oficial. Revisá el número, la profesión, la provincia y tu DNI o CUIT.';
    case 'MISMATCH':
      return 'La matrícula figura en el padrón, pero algún dato no coincide (nombre, apellido, profesión o provincia). Revisalos tal como están en tu título.';
    case 'NOT_ENABLED':
      return 'La matrícula figura en el padrón, pero hoy no está habilitada. Si es un error, regularizá tu situación en tu colegio o ministerio de salud.';
    case 'UNAVAILABLE':
      return 'No pudimos consultar el padrón en este momento. Podés continuar: una persona del equipo verificará tu matrícula antes de publicar tu perfil.';
    default:
      return 'Una persona del equipo verificará tu matrícula contra el padrón antes de publicar tu perfil.';
  }
}

export function gateResponse(r: MatriculaResult) {
  return { status: r.status, blocking: isBlocking(r.status), message: gateMessage(r.status) };
}
