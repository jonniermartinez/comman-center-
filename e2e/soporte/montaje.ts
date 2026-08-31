import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import { clienteDe } from "./api"
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
