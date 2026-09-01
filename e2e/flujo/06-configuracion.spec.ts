import { anotar } from "../soporte/anotaciones"
import { empresaPorSlug, perfilPorEmail } from "../soporte/api"
import { CUENTAS } from "../soporte/entorno"
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
 * Configuración: qué módulos usa la empresa y con qué catálogos.
 */

test.describe("Configuración de la empresa", () => {
  test(
    "apagar un módulo lo cierra en la navegación y por URL",
    anotar({
      modulo: "Configuración",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "No todas las empresas usan todos los módulos. Si apagarlo solo lo quitase del menú, " +
        "seguiría accesible escribiendo la dirección.",
    }),
    async ({ coordinador, apiSuperAdmin, mundo }) => {
      const empresa = await Promise.resolve({ id: mundo.empresaA.companyId })

      await apiSuperAdmin
        .from("company_modules")
        .delete()
        .eq("company_id", empresa!.id)
        .eq("module_code", "caja")

      await irA(coordinador, `/e/${mundo.empresaA.slug}/caja`)
      await expect(
        coordinador.locator("body"),
        "un módulo apagado sigue abriéndose por URL",
      ).toContainText(/Módulo no habilitado/i)

      await apiSuperAdmin
        .from("company_modules")
        .insert({ company_id: empresa!.id, module_code: "caja" } as never)
    },
  )

  test(
    "desactivar una financiación no borra su histórico",
    anotar({
      modulo: "Configuración",
      rol: "coordinador",
      tipo: "integridad",
      porque:
        "Los catálogos se marcan inactivos, no se borran: si una financiación vuelve a " +
        "usarse, las ventas antiguas que la referencian tienen que seguir teniendo sentido.",
    }),
    async ({ apiSuperAdmin, mundo }) => {
      const empresa = await Promise.resolve({ id: mundo.empresaA.companyId })

      const { data: antes } = await apiSuperAdmin
        .from("company_financing_types")
        .select("financing_code, active")
        .eq("company_id", empresa!.id)
        .limit(1)
        .single()

      await apiSuperAdmin
        .from("company_financing_types")
        .update({ active: false })
        .eq("company_id", empresa!.id)
        .eq("financing_code", antes!.financing_code)

      const { data: despues } = await apiSuperAdmin
        .from("company_financing_types")
        .select("financing_code, active")
        .eq("company_id", empresa!.id)
        .eq("financing_code", antes!.financing_code)
        .maybeSingle()

      expect(despues, "la financiación se borró en vez de desactivarse").toBeTruthy()
      expect(despues!.active).toBe(false)

      await apiSuperAdmin
        .from("company_financing_types")
        .update({ active: true })
        .eq("company_id", empresa!.id)
        .eq("financing_code", antes!.financing_code)
    },
  )
})
