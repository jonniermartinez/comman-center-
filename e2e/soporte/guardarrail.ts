import { EMPRESAS_REALES, PREFIJO } from "./entorno";

/**
 * Las pruebas corren contra producción, donde viven 16.500 ventas y 19.000
 * pagos reales que no tienen copia. Este archivo es lo que hace que eso sea
 * defendible: nada se borra ni se modifica si su nombre no empieza por el
 * prefijo de pruebas.
 *
 * La regla se aplica en el único punto por el que pasa toda escritura
 * destructiva (`api.ts`), no en cada prueba: una prueba nueva escrita con prisa
 * hereda la protección sin tener que acordarse de nada.
 */

export class DatoProtegido extends Error {
  constructor(que: string, valor: string) {
    super(
      `GUARDARRAÍL: se intentó ${que} sobre "${valor}", que no es un dato de prueba. ` +
        `Solo se puede tocar lo que empiece por "${PREFIJO}". Esto corre contra producción.`,
    );
    this.name = "DatoProtegido";
  }
}

/** ¿Es algo que crearon las pruebas? Único criterio válido para destruir. */
export function esDePrueba(nombreOSlug: string | null | undefined): boolean {
  if (!nombreOSlug) return false;
  return nombreOSlug.trim().toLowerCase().startsWith(PREFIJO);
}

/**
 * Puerta obligatoria antes de cualquier borrado o modificación.
 *
 * Comprueba dos cosas por separado a propósito: que lleve el prefijo, y que no
 * sea una de las empresas reales. Lo segundo es redundante mientras el prefijo
 * funcione, y justo por eso vale: si alguien un día relaja el prefijo, las
 * cinco empresas del cliente siguen protegidas.
 */
export function exigirDePrueba(
  que: string,
  nombreOSlug: string | null | undefined,
): string {
  const valor = (nombreOSlug ?? "").trim();

  if (EMPRESAS_REALES.includes(valor.toLowerCase())) {
    throw new DatoProtegido(`${que} (EMPRESA REAL DEL CLIENTE)`, valor);
  }
  if (!esDePrueba(valor)) {
    throw new DatoProtegido(que, valor);
  }
  return valor;
}

/** Nombre único para un recurso de prueba: siempre con prefijo, nunca repetido. */
export function nombreDePrueba(que: string): string {
  const sufijo = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return `${PREFIJO}${que}-${sufijo}`;
}
