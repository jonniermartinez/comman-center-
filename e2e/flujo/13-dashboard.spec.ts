import { anotar } from "../soporte/anotaciones"
import { empresaPorSlug, perfilPorEmail } from "../soporte/api"
import { CUENTAS, EMPRESA_A } from "../soporte/entorno"
import { expect, test } from "../soporte/fixtures"
import { irA } from "../soporte/reintento"

/**
 * Las pantallas con las que se configura el sistema: sedes, equipo, módulos,
 * catálogos, metas y el registro de quién hizo qué.
 *
 * Se usan poco —una empresa se configura una vez— y justo por eso se rompen sin
 * que nadie lo note: cuando hacen falta, hacen falta de verdad.
 */

/**
 * El resumen que ve cualquiera al entrar a una empresa.
 */

test.describe("Dashboard", () => {
  test(
    "el resumen de la empresa abre con sus cifras",
    anotar({
      modulo: "Dashboard",
      rol: ["coordinador", "asesor"],
      tipo: "feature",
      porque:
        "Es la primera pantalla que ve cualquiera al entrar a una empresa. Si falla, la " +
        "aplicación parece rota entera aunque el resto funcione.",
    }),
    async ({ coordinador, asesorA }) => {
      for (const pagina of [coordinador, asesorA]) {
        await irA(pagina, `/e/${EMPRESA_A}`)
        await expect(pagina.locator("body")).not.toContainText(/Application error|Unhandled/i)
        await expect(pagina.locator("body")).toContainText(EMPRESA_A)
      }
    },
  )

  test(
    "la lista de empresas suma solo las activas",
    anotar({
      modulo: "Empresas",
      rol: "super admin",
      tipo: "feature",
      porque:
        "La tira de totales del inicio agrega todas las empresas. Si contase las archivadas, " +
        "las cifras del mes saldrían infladas sin explicación visible.",
    }),
    async ({ superAdmin }) => {
      await irA(superAdmin, "/empresas")
      await expect(superAdmin.locator("body")).toContainText(/Ventas del mes/i)
      await expect(superAdmin.locator("body")).toContainText(/Facturación del mes/i)
    },
  )
})
