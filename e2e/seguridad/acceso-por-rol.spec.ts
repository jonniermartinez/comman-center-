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
    async ({ page }) => {
      await irA(page, "/login")
      await page.locator("#email").fill(CUENTAS.suspendido.email)
      await page.locator("#password").fill(CUENTAS.suspendido.password)
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

test.describe("Super admin", () => {
  test(
    "ve la administración de la plataforma",
    anotar({
      modulo: "Acceso",
      rol: "super admin",
      tipo: "feature",
      porque: "El super admin es el único que administra usuarios y consulta el log.",
    }),
    async ({ superAdmin }) => {
      await irA(superAdmin, "/empresas")
      await expect(superAdmin.getByRole("link", { name: "Usuarios" })).toBeVisible()
      await expect(superAdmin.getByRole("link", { name: "Auditoría" })).toBeVisible()
    },
  )

  test(
    "entra a usuarios y auditoría",
    anotar({
      modulo: "Acceso",
      rol: "super admin",
      tipo: "feature",
      porque: "Las dos pantallas de plataforma tienen que abrir para quien sí manda.",
    }),
    async ({ superAdmin }) => {
      await irA(superAdmin, "/admin/usuarios")
      await expect(superAdmin).toHaveURL(/\/admin\/usuarios/)
      await expect(superAdmin.locator("body")).not.toContainText("Sin acceso")

      await irA(superAdmin, "/admin/auditoria")
      await expect(superAdmin).toHaveURL(/\/admin\/auditoria/)
      await expect(superAdmin.locator("body")).not.toContainText("Sin acceso")
    },
  )

  test(
    "ve las dos empresas de prueba y puede crear",
    anotar({
      modulo: "Empresas",
      rol: "super admin",
      tipo: "feature",
      porque: "Ve todas las empresas y puede dar de alta clientes nuevos.",
    }),
    async ({ superAdmin }) => {
      await irA(superAdmin, "/empresas")
      await expect(superAdmin.getByRole("link", { name: /Nueva empresa/ })).toBeVisible()
      await expect(superAdmin.locator("body")).toContainText(EMPRESA_A)
      await expect(superAdmin.locator("body")).toContainText(EMPRESA_B)
    },
  )
})

test.describe("Coordinador", () => {
  test(
    "no ve la administración de la plataforma",
    anotar({
      modulo: "Acceso",
      rol: "coordinador",
      tipo: "seguridad",
      porque: "Un coordinador administra su empresa, no la plataforma.",
    }),
    async ({ coordinador }) => {
      await irA(coordinador, "/empresas")
      await expect(coordinador.getByRole("link", { name: "Auditoría" })).toHaveCount(0)
      await expect(coordinador.getByRole("link", { name: /Nueva empresa/ })).toHaveCount(0)
    },
  )

  test(
    "la auditoría le queda cerrada aunque entre por la URL",
    anotar({
      modulo: "Auditoría",
      rol: "coordinador",
      tipo: "seguridad",
      porque: "Que no salga en el menú no basta: la dirección se puede escribir.",
    }),
    async ({ coordinador }) => {
      await irA(coordinador, "/admin/auditoria")
      // No hay datos que enseñar: RLS solo deja leer el log al super admin.
      await expect(coordinador.locator("body")).not.toContainText("falsificado")
      const filas = await coordinador.getByRole("row").count()
      expect(filas, "un coordinador leyó filas del log de auditoría").toBeLessThanOrEqual(1)
    },
  )

  test(
    "administra su empresa: sedes, usuarios y configuración",
    anotar({
      modulo: "Configuración",
      rol: "coordinador",
      tipo: "feature",
      porque: "Es lo que distingue a un coordinador de un asesor.",
    }),
    async ({ coordinador }) => {
      await irA(coordinador, `/e/${EMPRESA_A}`)
      await expect(coordinador.getByRole("link", { name: "Sedes" })).toBeVisible()
      await expect(coordinador.getByRole("link", { name: "Configuración" })).toBeVisible()
    },
  )

  test("la empresa B le dice que no es suya", async ({ coordinador }) => {
    await irA(coordinador, `/e/${EMPRESA_B}`)
    await expect(coordinador.locator("body")).toContainText(/Sin acceso|no está asignado/i)
  })
})

test.describe("Asesor", () => {
  test(
    "no ve administración ni de la plataforma ni de la empresa",
    anotar({
      modulo: "Acceso",
      rol: "asesor",
      tipo: "seguridad",
      porque: "El asesor captura; no configura nada.",
    }),
    async ({ asesorA }) => {
      await irA(asesorA, `/e/${EMPRESA_A}`)

      await expect(asesorA.getByRole("link", { name: "Auditoría" })).toHaveCount(0)
      await expect(asesorA.getByRole("link", { name: "Sedes" })).toHaveCount(0)
      await expect(asesorA.getByRole("link", { name: "Configuración" })).toHaveCount(0)
      await expect(asesorA.getByRole("link", { name: /Nueva empresa/ })).toHaveCount(0)
    },
  )

  test(
    "sí ve los módulos de captura de su empresa",
    anotar({
      modulo: "Acceso",
      rol: "asesor",
      tipo: "feature",
      porque: "Quitarle de más le impediría trabajar, que es el otro modo de fallar.",
    }),
    async ({ asesorA }) => {
      await irA(asesorA, `/e/${EMPRESA_A}`)
      for (const modulo of ["Ventas", "Pagos", "Gestión Diaria", "Agendas"]) {
        await expect(asesorA.getByRole("link", { name: modulo })).toBeVisible()
      }
    },
  )

  test("la empresa B le dice que no es suya", async ({ asesorA }) => {
    await irA(asesorA, `/e/${EMPRESA_B}`)
    await expect(asesorA.locator("body")).toContainText(/Sin acceso|no está asignado/i)
  })

  test(
    "las empresas reales del cliente tampoco",
    anotar({
      modulo: "Acceso",
      rol: "asesor",
      tipo: "seguridad",
      porque: "Ni por la dirección directa se llega a una empresa ajena.",
    }),
    async ({ asesorA }) => {
      for (const real of ["cea", "ttc"]) {
        await irA(asesorA, `/e/${real}`)
        await expect(
          asesorA.locator("body"),
          `el asesor de pruebas entró a ${real}`,
        ).toContainText(/Sin acceso|no está asignado|no encontrada/i)
      }
    },
  )

  test(
    "en su lista solo aparece su empresa",
    anotar({
      modulo: "Empresas",
      rol: "asesor",
      tipo: "seguridad",
      porque: "La lista de inicio no puede filtrar el nombre de otros clientes.",
    }),
    async ({ asesorA }) => {
      await irA(asesorA, "/empresas")
      await expect(asesorA.locator("body")).toContainText(EMPRESA_A)
      await expect(asesorA.locator("body")).not.toContainText(EMPRESA_B)
      await expect(asesorA.locator("body")).not.toContainText("CEA")
    },
  )

  test(
    "la administración de la plataforma no le abre",
    anotar({
      modulo: "Usuarios",
      rol: "asesor",
      tipo: "seguridad",
      porque: "Ahí está la lista de las cincuenta personas reales del sistema.",
    }),
    async ({ asesorA }) => {
      await irA(asesorA, "/admin/usuarios")
      // Ni la lista de las 50 personas reales ni el botón de invitar.
      await expect(asesorA.getByRole("button", { name: /Invitar|Nuevo usuario/i })).toHaveCount(
        0,
      )
    },
  )
})
