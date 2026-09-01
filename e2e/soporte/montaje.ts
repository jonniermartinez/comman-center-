import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import { clienteDe } from "./api"
import { esDePrueba } from "./guardarrail"
import { BASE_URL, CUENTAS } from "./entorno"
import { irA } from "./reintento"

export const CARPETA_SESIONES = path.join(".auth")
export const SESION_SUPER_ADMIN = path.join(CARPETA_SESIONES, "superAdmin.json")

/**
 * Lo único que hace falta antes de empezar: que el super admin pueda entrar.
 *
 * Antes esto sembraba a mano cinco cuentas y dos empresas que se quedaban vivas
 * en la base del cliente entre corridas. Estaba mal: las cuentas del equipo
 * tienen que crearlas las pruebas, llamando a las mismas funciones que usa la
 * aplicación, como haría una persona dando de alta a su gente. De eso se ocupa
 * el fixture `mundo`, que además las purga al terminar.
 *
 * Solo una cuenta preexiste con contraseña guardada: este super admin. Es el
 * equivalente al primer usuario de la instalación, el que no puede crear nadie
 * porque no habría quién.
 */
/**
 * Barre lo que dejó una corrida anterior.
 *
 * El desmontaje de Playwright no se ejecuta si el proceso se mata: basta con
 * parar las pruebas desde el editor para que las empresas, las cuentas y las
 * personas de esa corrida se queden en la base del cliente. Pasó, y en una
 * tarde se acumularon nueve empresas y sesenta y cuatro personas.
 *
 * Por eso se limpia también al empezar, no solo al terminar: así una corrida
 * interrumpida se cura sola en la siguiente en vez de sumar.
 *
 * Solo toca lo que lleva el prefijo de pruebas, y las personas solo si no
 * tienen ni un registro a su nombre.
 */
async function barrerRestos(admin: Awaited<ReturnType<typeof clienteDe>>) {
  const { data: empresas } = await admin.from("companies").select("id, slug, name")
  const deAntes = (empresas ?? []).filter((c) => esDePrueba(c.slug) && esDePrueba(c.name))

  for (const empresa of deAntes) {
    const { error } = await admin.rpc("delete_company_cascade", {
      target_company: empresa.id,
      confirm_name: empresa.name,
    })
    if (error) console.error(`barrido: quedó la empresa ${empresa.slug}: ${error.message}`)
  }

  // Las diez del plantel son permanentes: se reutilizan en cada corrida y son
  // justo lo que evita que la lista de usuarios del cliente se llene. Solo se
  // purga lo que alguna prueba dejó suelto.
  const delPlantel = new Set(Object.values(CUENTAS).map((c) => c.email))
  const { data: cuentas } = await admin
    .from("profiles")
    .select("id, email")
    .like("email", "e2e%")
  const sueltas = (cuentas ?? []).filter((c) => !delPlantel.has(c.email))
  for (const cuenta of sueltas) {
    const { error } = await admin.rpc("purge_test_user", { target_user: cuenta.id })
    if (error) console.error(`barrido: quedó la cuenta ${cuenta.email}: ${error.message}`)
  }

  // Las personas del catálogo son globales: no se las lleva ni borrar la
  // empresa ni purgar la cuenta. Se quitan las que quedaron huérfanas, pero no
  // las del plantel: esas están enlazadas a sus cuentas y se reutilizan.
  const { data: personas } = await admin
    .from("staff")
    .select("id, profile_id")
    .like("full_name", "E2E %")
  const dePlantel = new Set(
    ((await admin.from("profiles").select("id, email").like("email", "e2e%")).data ?? [])
      .filter((p) => delPlantel.has(p.email))
      .map((p) => p.id),
  )
  const huerfanas = (personas ?? []).filter(
    (p) => !p.profile_id || !dePlantel.has(p.profile_id),
  )
  for (const persona of huerfanas) {
    await admin.from("company_staff").delete().eq("staff_id", persona.id)
    await admin.from("staff").delete().eq("id", persona.id)
  }

  if (deAntes.length || sueltas.length || huerfanas.length) {
    console.log(
      `Barrido de restos: ${deAntes.length} empresa(s), ${sueltas.length} cuenta(s), ` +
        `${huerfanas.length} persona(s) de una corrida anterior.`,
    )
  }
}

export default async function montaje() {
  const admin = await clienteDe("superAdmin")
  const { data } = await admin.rpc("me")
  const perfil = (data as { profile?: { role?: string } } | null)?.profile
  if (perfil?.role !== "super_admin") {
    throw new Error(
      `${CUENTAS.superAdmin.email} no es super admin activo. Sin esa cuenta no se monta ` +
        `nada: revísala en la base o vuelve a darle clave con admin_set_password.`,
    )
  }

  await barrerRestos(admin)

  fs.mkdirSync(CARPETA_SESIONES, { recursive: true })
  const navegador = await chromium.launch()
  const contexto = await navegador.newContext({ baseURL: BASE_URL })
  const pagina = await contexto.newPage()

  let dentro = false
  let ultimoFallo = ""
  for (let intento = 1; intento <= 3 && !dentro; intento++) {
    try {
      await irA(pagina, "/login")
      await pagina.locator("#email").waitFor({ state: "visible", timeout: 45_000 })
      await pagina.locator("#email").fill(CUENTAS.superAdmin.email)
      await pagina.locator("#password").fill(CUENTAS.superAdmin.password)
      await pagina.getByRole("button", { name: "Entrar" }).click()
      await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 })
      dentro = true
    } catch (fallo) {
      const pantalla = await pagina
        .locator("body")
        .innerText()
        .catch(() => "(sin cuerpo)")
      ultimoFallo = `URL: ${pagina.url()}\nPantalla: ${pantalla.slice(0, 300)}\nCausa: ${fallo}`
      if (intento < 3) await pagina.waitForTimeout(intento * 3000)
    }
  }

  if (!dentro) {
    throw new Error(`Montaje: el super admin no pudo entrar en 3 intentos.\n${ultimoFallo}`)
  }

  await contexto.storageState({ path: SESION_SUPER_ADMIN })
  await contexto.close()
  await navegador.close()
}
