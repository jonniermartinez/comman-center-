import { test as base, type Page } from "@playwright/test"

import { clienteDe, type Cliente } from "./api"
import { rutaSesion } from "./montaje"
import type { Rol } from "./entorno"

/**
 * Una pestaña ya con la sesión de cada rol, y un cliente de base con esa misma
 * identidad.
 *
 * Las dos caras hacen falta y prueban cosas distintas: la pestaña dice qué ve
 * la persona, el cliente dice qué le daría la base si preguntara por su cuenta.
 * Una prueba de seguridad que solo mire la pestaña no prueba nada: los botones
 * se pueden pintar con las herramientas del navegador.
 */
async function paginaComo(rol: Rol, navegador: import("@playwright/test").Browser) {
  const contexto = await navegador.newContext({
    storageState: rutaSesion(rol),
  })
  const pagina = await contexto.newPage()
  return { contexto, pagina }
}

export const test = base.extend<{
  superAdmin: Page
  coordinador: Page
  asesorA: Page
  asesorB: Page
  apiSuperAdmin: Cliente
  apiCoordinador: Cliente
  apiAsesorA: Cliente
  apiAsesorB: Cliente
}>({
  superAdmin: async ({ browser }, usar) => {
    const { contexto, pagina } = await paginaComo("superAdmin", browser)
    await usar(pagina)
    await contexto.close()
  },
  coordinador: async ({ browser }, usar) => {
    const { contexto, pagina } = await paginaComo("coordinador", browser)
    await usar(pagina)
    await contexto.close()
  },
  asesorA: async ({ browser }, usar) => {
    const { contexto, pagina } = await paginaComo("asesorA", browser)
    await usar(pagina)
    await contexto.close()
  },
  asesorB: async ({ browser }, usar) => {
    const { contexto, pagina } = await paginaComo("asesorB", browser)
    await usar(pagina)
    await contexto.close()
  },

  apiSuperAdmin: async ({}, usar) => {
    // No se cierra sesión al terminar: el cliente es compartido por todo el
    // proceso a propósito (ver `clienteDe`).
    await usar(await clienteDe("superAdmin"))
  },
  apiCoordinador: async ({}, usar) => {
    // No se cierra sesión al terminar: el cliente es compartido por todo el
    // proceso a propósito (ver `clienteDe`).
    await usar(await clienteDe("coordinador"))
  },
  apiAsesorA: async ({}, usar) => {
    // No se cierra sesión al terminar: el cliente es compartido por todo el
    // proceso a propósito (ver `clienteDe`).
    await usar(await clienteDe("asesorA"))
  },
  apiAsesorB: async ({}, usar) => {
    // No se cierra sesión al terminar: el cliente es compartido por todo el
    // proceso a propósito (ver `clienteDe`).
    await usar(await clienteDe("asesorB"))
  },
})

export { expect } from "@playwright/test"
