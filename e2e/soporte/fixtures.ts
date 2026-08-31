import { test as base, type Page } from "@playwright/test"

import {
  asignarAEmpresa,
  borrarEmpresa,
  clienteDe,
  crearEmpresa,
  empresaPorSlug,
  vincularStaff,
  type Cliente,
} from "./api"
import { CUENTAS } from "./entorno"
import { nombreDePrueba } from "./guardarrail"
import { nuevoRastro, type Rastro } from "./rastro"
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
  rastro: Rastro
  empresaPropia: EmpresaPropia
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

  /**
   * Apunta lo que la prueba crea y se lo lleva al terminar, pase lo que pase.
   *
   * Playwright ejecuta este desmontaje aunque la prueba falle o se agote el
   * tiempo, que es exactamente cuando limpiar en la última línea del test no
   * sirve de nada.
   */
  rastro: async ({ apiSuperAdmin }, usar) => {
    const { rastro, limpiar } = nuevoRastro()
    await usar(rastro)
    await limpiar(apiSuperAdmin)
  },

  /**
   * Una empresa ficticia entera, solo para esta prueba.
   *
   * Las pruebas no tocan las empresas del cliente ni de lejos: cada una que lo
   * pida estrena la suya, con su sede y su equipo, y al terminar se borra
   * completa. Eso se lleva de paso todo lo que se haya creado dentro, incluido
   * lo que no se puede borrar fila a fila.
   *
   * Cuesta un par de segundos montarla, así que solo la piden las pruebas que
   * escriben de verdad; las de permisos y lectura usan el banco compartido.
   */
  empresaPropia: async ({ apiSuperAdmin }, usar) => {
    const nombre = nombreDePrueba("empresa")
    await crearEmpresa(apiSuperAdmin, nombre)
    await asignarAEmpresa(apiSuperAdmin, CUENTAS.coordinador.email, nombre, "coordinador")
    await asignarAEmpresa(apiSuperAdmin, CUENTAS.asesorA.email, nombre, "asesor")
    await vincularStaff(apiSuperAdmin, CUENTAS.asesorA.email, nombre)

    const empresa = await empresaPorSlug(apiSuperAdmin, nombre)
    const { data: sede } = await apiSuperAdmin
      .from("branches")
      .select("id")
      .eq("company_id", empresa!.id)
      .eq("is_primary", true)
      .single()

    await usar({ slug: nombre, companyId: empresa!.id, branchId: sede!.id })

    await borrarEmpresa(apiSuperAdmin, nombre)
  },
})

export interface EmpresaPropia {
  slug: string
  companyId: string
  branchId: string
}

export { expect } from "@playwright/test"
