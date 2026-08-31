import { anotar } from "../soporte/anotaciones"
import { CUENTAS, EMPRESA_A, EMPRESA_B } from "../soporte/entorno"
import { expect, test } from "../soporte/fixtures"
import { irA } from "../soporte/reintento"

/**
 * Lo que cada rol ve y a dónde puede llegar por la aplicación.
 *
 * Complementa a `rls-directo.spec.ts`, que prueba lo que da la base. Aquí se
 * prueba la otra mitad: que la pantalla no ofrezca puertas que la base va a
 * cerrar después. Las dos capas tienen que decir lo mismo; cuando difieren, o
 * hay un botón que frustra al usuario o hay uno que no debería existir.
 */

test.describe("Sin sesión", () => {
  test(
    "las pantallas de dentro mandan al login",
    anotar({
      modulo: "Acceso",
      rol: "anónimo",
      tipo: "seguridad",
      porque:
        "Ninguna pantalla con datos puede abrirse sin sesión, ni escribiendo la dirección a mano.",
    }),
    async ({ page }) => {
      for (const ruta of [
        "/empresas",
        "/admin/usuarios",
        "/admin/auditoria",
        `/e/${EMPRESA_A}`,
      ]) {
        await irA(page, ruta)
        await expect(page, `${ruta} no exigió sesión`).toHaveURL(/\/login/)
      }
    },
  )

  test(
    "una cuenta suspendida no entra",
    anotar({
      modulo: "Acceso",
      rol: "suspendido",
      tipo: "seguridad",
      porque: "Suspender tiene que cortar el login, no solo esconder los datos.",
    }),
    async ({ page, mundo }) => {
      // La cuenta suspendida la crea el mundo y la suspende de verdad: perfil
      // inactivo y login bloqueado en Auth.
      await irA(page, "/login")
      await page.locator("#email").fill(mundo.suspendido.email)
      await page.locator("#password").fill(mundo.suspendido.password!)
      await page.getByRole("button", { name: "Entrar" }).click()

      // Se queda en el login y lo dice; no cae dentro con una pantalla vacía.
      await expect(page).toHaveURL(/\/login/)
      await expect(page.locator("body")).toContainText(/no|error|incorrect|bloque|suspend/i)
    },
  )

  test(
    "una contraseña incorrecta no entra",
    anotar({
      modulo: "Acceso",
      rol: "anónimo",
      tipo: "seguridad",
      porque: "Lo mínimo exigible a un formulario de acceso.",
    }),
    async ({ page }) => {
      await irA(page, "/login")
      await page.locator("#email").fill(CUENTAS.superAdmin.email)
      await page.locator("#password").fill("esta-no-es-la-clave")
      await page.getByRole("button", { name: "Entrar" }).click()

      await expect(page).toHaveURL(/\/login/)
    },
  )
})
