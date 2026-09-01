import { expect, type Page } from "@playwright/test"

import {
  asignarAEmpresa,
  borrarEmpresa,
  crearEmpresa,
  empresaPorSlug,
  vincularStaff,
  type Cliente,
} from "./api"
import { CUENTAS, type Cuenta } from "./entorno"
import { nombreDePrueba } from "./guardarrail"
import type { Rastro } from "./rastro"
import { irA } from "./reintento"

/**
 * Lo que se hace en el sistema, en piezas que se componen.
 *
 * En este dominio todo cuelga de todo: una empresa necesita sus sedes, el
 * equipo necesita la empresa, registrar una venta necesita al comercial
 * enlazado con una persona del equipo. Si cada prueba monta esa cadena por su
 * cuenta, la cadena acaba escrita quince veces y con quince variantes sutiles,
 * y el día que cambia una regla hay que encontrarlas todas.
 *
 * Aquí está cada eslabón una vez. Una prueba de equipo pide el equipo y no le
 * importa cómo se crea; una de captura pide la empresa con su gente y se pone a
 * capturar. Lo que se crea se apunta en el rastro, así que se limpia solo.
 */

// ------------------------------------------------------------
// Por la interfaz
// ------------------------------------------------------------

/**
 * Da de alta una empresa recorriendo el asistente de cuatro pasos.
 *
 * Es el camino que hace una persona de verdad, con sus cuatro pantallas, y por
 * eso lo usan las pruebas que comprueban el alta. Estaba copiado en las cuatro
 * pruebas de empresas: cuatro sitios donde tocar si el asistente cambia de un
 * paso o el botón cambia de texto.
 */
export async function altaDeEmpresaPorLaInterfaz(pagina: Page, nombre: string) {
  await irA(pagina, "/empresas/nueva")
  await pagina.locator("#name").fill(nombre)

  for (let paso = 1; paso < 4; paso++) {
    await pagina.getByRole("button", { name: "Siguiente" }).click()
  }

  const crear = pagina.getByRole("button", { name: /Crear empresa/ })
  await expect(crear, "el botón de crear no llegó a habilitarse").toBeEnabled()
  return crear
}

/** El alta completa: recorre el asistente, envía y espera a estar dentro. */
export async function crearEmpresaPorLaInterfaz(pagina: Page, nombre: string) {
  const crear = await altaDeEmpresaPorLaInterfaz(pagina, nombre)
  await crear.click()
  await pagina.waitForURL(/\/e\//, { timeout: 30_000 })
  return nombre
}

// ------------------------------------------------------------
// Por la base, con la sesión de quien corresponda
// ------------------------------------------------------------

export type RolCuenta = "asesor" | "coordinador" | "super_admin"

export interface CuentaCreada {
  id: string
  email: string
  nombre: string
  rol: RolCuenta
  /** Solo si se pidió con acceso: la clave con la que puede entrar. */
  password?: string
}

/**
 * Crea una cuenta con un rol y la deja apuntada para revocarla al final.
 *
 * El correo lleva marca de tiempo porque el sistema no admite dos cuentas con
 * el mismo, y estas pruebas corren muchas veces contra la misma base.
 */
export async function crearUsuario(
  admin: Cliente,
  rastro: Rastro | null,
  rol: RolCuenta,
  opciones: { conAcceso?: boolean; email?: string } = {},
): Promise<CuentaCreada> {
  const sufijo = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
  // Se puede pedir una dirección concreta: las pruebas de correo necesitan una
  // de las que tienen regla de enrutamiento hacia el buzón, y esas son fijas.
  const email = opciones.email ?? `e2e_command_${rol}_${sufijo}@jonnier.com`
  const nombre = `E2E ${rol} ${sufijo}`
  // Con acceso, la cuenta nace confirmada y con clave: es lo que hace la
  // aplicación al dar de alta al equipo de una empresa sin esperar correos.
  const password = opciones.conAcceso
    ? `E2e-${sufijo}-${Math.random().toString(36).slice(2, 10)}`
    : undefined

  // Si la dirección se pidió a mano puede quedar ocupada de una corrida
  // anterior que no llegó a limpiar. Se libera antes: son direcciones de
  // prueba y `purge_test_user` solo acepta esas.
  if (opciones.email) {
    const { data: previo } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()
    if (previo) await admin.rpc("purge_test_user", { target_user: previo.id })
  }

  const { data: id, error } = await admin.rpc("admin_create_user", {
    p_email: email,
    p_full_name: nombre,
    p_role: rol,
    ...(password ? { p_password: password, p_confirmado: true } : {}),
  })
  if (error || !id) throw new Error(`crearUsuario(${rol}): ${error?.message}`)

  rastro?.anotarUsuario(id as string)
  return { id: id as string, email, nombre, rol, password }
}

/**
 * Una empresa con su equipo completo: un coordinador y un asesor.
 *
 * Es el punto de partida de casi todo lo que se puede probar de una empresa, y
 * lo que hace falta para comprobar que cada rol llega hasta donde le toca y no
 * más allá.
 */
export async function empresaConEquipo(admin: Cliente, rastro: Rastro) {
  const slug = nombreDePrueba("empresa")
  await crearEmpresa(admin, slug)

  const coordinador = await crearUsuario(admin, rastro, "coordinador")
  const asesor = await crearUsuario(admin, rastro, "asesor")

  await asignarAEmpresa(admin, coordinador.email, slug, "coordinador")
  await asignarAEmpresa(admin, asesor.email, slug, "asesor")
  // Sin persona del equipo enlazada, el asesor no puede registrar a su nombre.
  //
  // Y hay que apuntarla: `staff` es un catálogo global —una persona puede
  // trabajar en varias empresas—, así que borrar la empresa no se la lleva, y
  // purgar la cuenta solo suelta el enlace. Sin esto se acumulan para siempre:
  // pasaron de 2 a 64 en una tarde, apareciendo como comerciales en los
  // desplegables del cliente.
  const staffId = await vincularStaff(admin, asesor.email, slug)
  rastro.anotar("staff", staffId)

  const empresa = await empresaPorSlug(admin, slug)
  const { data: sede } = await admin
    .from("branches")
    .select("id")
    .eq("company_id", empresa!.id)
    .eq("is_primary", true)
    .single()

  return {
    slug,
    companyId: empresa!.id,
    branchId: sede!.id,
    coordinador,
    asesor,
    staffId,
  }
}

/**
 * El mundo que necesitan las pruebas: dos empresas con su equipo dentro.
 *
 * Las personas ya existen —son el plantel fijo de `CUENTAS`— así que aquí solo
 * se crean las empresas y se mete a cada quien en la suya. Al terminar se
 * borran las empresas y las cuentas siguen ahí para la próxima corrida: por eso
 * la pantalla de usuarios del cliente no se llena de gente inventada.
 *
 * Se monta una vez por proceso de Playwright, no una por prueba.
 */
export interface Mundo {
  empresaA: { slug: string; companyId: string; branchId: string }
  empresaB: { slug: string; companyId: string; branchId: string }
  coordinador: Cuenta
  asesorA: Cuenta
  /** El compañero del asesor A, en su misma empresa. */
  asesorA2: Cuenta
  asesorB: Cuenta
  suspendido: Cuenta
  sinEmpresa: Cuenta
  /** La persona del catálogo de cada asesor, que es quien figura como responsable. */
  staffA: string
  staffA2: string
  staffB: string
}

export async function montarMundo(admin: Cliente): Promise<Mundo> {
  const slugA = nombreDePrueba("empresa-a")
  const slugB = nombreDePrueba("empresa-b")
  await crearEmpresa(admin, slugA)
  await crearEmpresa(admin, slugB)

  await asignarAEmpresa(admin, CUENTAS.coordinadorA.email, slugA, "coordinador")
  await asignarAEmpresa(admin, CUENTAS.asesorA1.email, slugA, "asesor")
  await asignarAEmpresa(admin, CUENTAS.asesorA2.email, slugA, "asesor")
  await asignarAEmpresa(admin, CUENTAS.coordinadorB.email, slugB, "coordinador")
  await asignarAEmpresa(admin, CUENTAS.asesorB1.email, slugB, "asesor")

  // Sin persona del catálogo enlazada, un asesor no puede registrar a su
  // nombre. `vincularStaff` reutiliza la que ya exista para esa cuenta, así que
  // se crean una vez y no se multiplican entre corridas.
  const staffA = await vincularStaff(admin, CUENTAS.asesorA1.email, slugA)
  const staffA2 = await vincularStaff(admin, CUENTAS.asesorA2.email, slugA)
  const staffB = await vincularStaff(admin, CUENTAS.asesorB1.email, slugB)

  const datos = async (slug: string) => {
    const empresa = await empresaPorSlug(admin, slug)
    const { data: sede } = await admin
      .from("branches")
      .select("id")
      .eq("company_id", empresa!.id)
      .eq("is_primary", true)
      .single()
    return { slug, companyId: empresa!.id, branchId: sede!.id }
  }

  return {
    empresaA: await datos(slugA),
    empresaB: await datos(slugB),
    coordinador: CUENTAS.coordinadorA,
    asesorA: CUENTAS.asesorA1,
    asesorA2: CUENTAS.asesorA2,
    asesorB: CUENTAS.asesorB1,
    suspendido: CUENTAS.suspendido,
    sinEmpresa: CUENTAS.sinEmpresa,
    staffA,
    staffA2,
    staffB,
  }
}

/**
 * Se lleva las empresas y nada más.
 *
 * Las cuentas y sus personas del catálogo se quedan: son el plantel, y
 * recrearlas en cada corrida es justo lo que llenaba la base de basura. Borrar
 * la empresa ya deshace las asignaciones y todo lo capturado dentro.
 */
export async function desmontarMundo(admin: Cliente, mundo: Mundo) {
  for (const empresa of [mundo.empresaA, mundo.empresaB]) {
    await borrarEmpresa(admin, empresa.slug).catch((e) => console.error("desmontarMundo:", e))
  }
}
