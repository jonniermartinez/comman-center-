import { test as base, type Browser, type Page } from "@playwright/test"

import { desmontarMundo, montarMundo, type CuentaCreada, type Mundo } from "./acciones"
import {
  asignarAEmpresa,
  borrarEmpresa,
  clienteAnonimo,
  clienteDe,
  crearEmpresa,
  empresaPorSlug,
  vincularStaff,
  type Cliente,
} from "./api"
import { BASE_URL } from "./entorno"
import { nombreDePrueba } from "./guardarrail"
import { nuevoRastro, type Rastro } from "./rastro"
import { SESION_SUPER_ADMIN } from "./montaje"
import { irA } from "./reintento"

/**
 * Cada rol tiene dos caras en las pruebas, y las dos hacen falta.
 *
 * La pestaña dice **qué ve la persona**; el cliente de base dice **qué le daría
 * Postgres si preguntara por su cuenta**, sin pasar por la interfaz. La segunda
 * es la que vale para seguridad: que a un asesor no se le pinte un botón no
 * demuestra nada, los botones se pintan con las herramientas del navegador.
 *
 * Las cuentas de esos roles no están sembradas: las crea el fixture `mundo` al
 * arrancar cada proceso, con las mismas funciones que usa la aplicación, y las
 * purga al terminar. Solo el super admin preexiste.
 */

/** Abre sesión por el formulario, como haría la persona a la que representa. */
async function iniciarSesion(navegador: Browser, cuenta: CuentaCreada) {
  if (!cuenta.password) throw new Error(`La cuenta ${cuenta.email} se creó sin clave`)

  const contexto = await navegador.newContext({ baseURL: BASE_URL })
  const pagina = await contexto.newPage()
  await irA(pagina, "/login")
  await pagina.locator("#email").waitFor({ state: "visible", timeout: 45_000 })
  await pagina.locator("#email").fill(cuenta.email)
  await pagina.locator("#password").fill(cuenta.password)
  await pagina.getByRole("button", { name: "Entrar" }).click()
  await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 })

  const estado = await contexto.storageState()
  await contexto.close()
  return estado
}

/** Un cliente de base con la sesión de una cuenta recién creada. */
async function clienteDeCuenta(cuenta: CuentaCreada): Promise<Cliente> {
  if (!cuenta.password) throw new Error(`La cuenta ${cuenta.email} se creó sin clave`)
  const cliente = clienteAnonimo()
  const { error } = await cliente.auth.signInWithPassword({
    email: cuenta.email,
    password: cuenta.password,
  })
  if (error) throw new Error(`No se pudo entrar como ${cuenta.email}: ${error.message}`)
  return cliente
}

type Sesiones = {
  coordinador: Awaited<ReturnType<typeof iniciarSesion>>
  asesorA: Awaited<ReturnType<typeof iniciarSesion>>
  asesorB: Awaited<ReturnType<typeof iniciarSesion>>
}

type Clientes = {
  coordinador: Cliente
  asesorA: Cliente
  asesorB: Cliente
}

export const test = base.extend<
  {
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
  },
  {
    mundo: Mundo
    sesiones: Sesiones
    clientes: Clientes
  }
>({
  /**
   * El equipo y las empresas con las que trabajan las pruebas.
   *
   * Se monta una vez por proceso —no por prueba— porque crear seis cuentas y
   * dos empresas antes de cada una de las ciento veinte costaría minutos y
   * dispararía el límite de inicios de sesión de Auth.
   */
  mundo: [
    async ({}, usar) => {
      const admin = await clienteDe("superAdmin")
      const mundo = await montarMundo(admin)
      await usar(mundo)
      await desmontarMundo(admin, mundo)
    },
    { scope: "worker" },
  ],

  /** Una sesión de navegador por rol, abierta con las cuentas del mundo. */
  sesiones: [
    async ({ mundo, browser }, usar) => {
      await usar({
        coordinador: await iniciarSesion(browser, mundo.coordinador),
        asesorA: await iniciarSesion(browser, mundo.asesorA),
        asesorB: await iniciarSesion(browser, mundo.asesorB),
      })
    },
    { scope: "worker" },
  ],

  /** Y un cliente de base por rol, con esas mismas cuentas. */
  clientes: [
    async ({ mundo }, usar) => {
      await usar({
        coordinador: await clienteDeCuenta(mundo.coordinador),
        asesorA: await clienteDeCuenta(mundo.asesorA),
        asesorB: await clienteDeCuenta(mundo.asesorB),
      })
    },
    { scope: "worker" },
  ],

  superAdmin: async ({ browser }, usar) => {
    const contexto = await browser.newContext({ storageState: SESION_SUPER_ADMIN })
    await usar(await contexto.newPage())
    await contexto.close()
  },
  coordinador: async ({ browser, sesiones }, usar) => {
    const contexto = await browser.newContext({ storageState: sesiones.coordinador })
    await usar(await contexto.newPage())
    await contexto.close()
  },
  asesorA: async ({ browser, sesiones }, usar) => {
    const contexto = await browser.newContext({ storageState: sesiones.asesorA })
    await usar(await contexto.newPage())
    await contexto.close()
  },
  asesorB: async ({ browser, sesiones }, usar) => {
    const contexto = await browser.newContext({ storageState: sesiones.asesorB })
    await usar(await contexto.newPage())
    await contexto.close()
  },

  // Los clientes de base no se cierran al terminar cada prueba: son de proceso
  // a propósito, para no reautenticar ciento veinte veces.
  apiSuperAdmin: async ({}, usar) => {
    await usar(await clienteDe("superAdmin"))
  },
  apiCoordinador: async ({ clientes }, usar) => {
    await usar(clientes.coordinador)
  },
  apiAsesorA: async ({ clientes }, usar) => {
    await usar(clientes.asesorA)
  },
  apiAsesorB: async ({ clientes }, usar) => {
    await usar(clientes.asesorB)
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
   * Una empresa ficticia entera, solo para esta prueba, con el equipo del
   * mundo dentro. Al terminar se borra completa, y eso se lleva de paso todo lo
   * que se haya creado dentro.
   */
  empresaPropia: async ({ apiSuperAdmin, mundo }, usar) => {
    const nombre = nombreDePrueba("empresa")
    await crearEmpresa(apiSuperAdmin, nombre)
    await asignarAEmpresa(apiSuperAdmin, mundo.coordinador.email, nombre, "coordinador")
    await asignarAEmpresa(apiSuperAdmin, mundo.asesorA.email, nombre, "asesor")
    await vincularStaff(apiSuperAdmin, mundo.asesorA.email, nombre)

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
