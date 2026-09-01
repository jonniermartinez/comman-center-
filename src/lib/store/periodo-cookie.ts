/**
 * Nombre de la cookie donde se recuerda el mes elegido.
 *
 * Vive en su propio archivo porque lo comparten el provider —que corre en el
 * cliente y la escribe— y el ayudante de servidor, que la lee con `next/headers`
 * y no se puede importar desde un componente de cliente.
 */
export const COOKIE_MES = "cc_mes"
