import type { Page } from "@playwright/test"

/**
 * El worker de producción devuelve 503 (Cloudflare 1102, "Worker exceeded
 * resource limits") en una de cada seis peticiones, sin concurrencia ninguna.
 *
 * Esto reintenta para que el resto de pruebas midan lo que dicen medir y no la
 * inestabilidad del despliegue. **No es una forma de tapar el problema**: hay
 * una prueba dedicada, `features/estabilidad.spec.ts`, cuyo único trabajo es
 * fallar mientras esto siga pasando. Reintentar aquí y vigilarlo allí es la
 * única manera de que un fallo de aislamiento entre empresas no quede escondido
 * detrás de un 503 intermitente.
 */

const ERROR_DE_WORKER = /Worker exceeded resource limits|Error 1102|error code: 1102/i

export async function pareceCaidaDelWorker(pagina: Page): Promise<boolean> {
  const texto = await pagina
    .locator("body")
    .innerText()
    .catch(() => "")
  return ERROR_DE_WORKER.test(texto)
}

/** Navega reintentando mientras la respuesta sea una caída del worker. */
export async function irA(pagina: Page, ruta: string, intentos = 4): Promise<void> {
  for (let intento = 1; intento <= intentos; intento++) {
    const respuesta = await pagina.goto(ruta, { waitUntil: "domcontentloaded" })
    const caido = respuesta?.status() === 503 || (await pareceCaidaDelWorker(pagina))

    if (!caido) return
    if (intento === intentos) {
      throw new Error(
        `${ruta} devolvió "Worker exceeded resource limits" en ${intentos} intentos seguidos. ` +
          `El despliegue no está sirviendo, no es un fallo de la prueba.`,
      )
    }
    await pagina.waitForTimeout(intento * 1500)
  }
}
