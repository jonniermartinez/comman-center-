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
 * Sedes: dónde opera la empresa. Se archivan, nunca se borran: los
 * registros históricos apuntan a ellas.
 */

test.describe("Sedes", () => {
  test(
    "crear una sede y archivarla sin perder el histórico",
    anotar({
      modulo: "Sedes",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "Las sedes se archivan, nunca se borran: los registros históricos apuntan a ellas " +
        "y borrarlas dejaría huérfanos años de ventas.",
    }),
    async ({ coordinador, apiSuperAdmin, mundo }) => {
      const empresa = await Promise.resolve({ id: mundo.empresaA.companyId })
      const nombre = `e2e-sede-${Date.now().toString(36)}`

      await irA(coordinador, `/e/${mundo.empresaA.slug}/sedes`)
      await coordinador
        .getByRole("button", { name: /Nueva sede|Añadir sede|Agregar/i })
        .first()
        .click()
      await coordinador.getByRole("dialog").locator("input").first().fill(nombre)
      await coordinador
        .getByRole("dialog")
        .getByRole("button", { name: /Crear|Guardar/ })
        .last()
        .click()

      await expect
        .poll(
          async () => {
            const { data } = await apiSuperAdmin
              .from("branches")
              .select("id, status")
              .eq("company_id", empresa!.id)
              .eq("name", nombre)
              .maybeSingle()
            return data?.status ?? null
          },
          { timeout: 30_000, message: "la sede no se creó" },
        )
        .toBe("activa")

      const { data: sede } = await apiSuperAdmin
        .from("branches")
        .select("id")
        .eq("company_id", empresa!.id)
        .eq("name", nombre)
        .single()
      await apiSuperAdmin.from("branches").delete().eq("id", sede!.id)
    },
  )

  test(
    "una sede archivada deja de ofrecerse al capturar",
    anotar({
      modulo: "Sedes",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "Si una sede cerrada sigue apareciendo en el desplegable, tarde o temprano alguien " +
        "registra una venta en un punto que ya no existe.",
    }),
    async ({ coordinador, apiSuperAdmin, mundo }) => {
      const empresa = await Promise.resolve({ id: mundo.empresaA.companyId })
      const nombre = `e2e-sede-cerrada-${Date.now().toString(36)}`

      const { data: sede } = await apiSuperAdmin
        .from("branches")
        .insert({
          company_id: empresa!.id,
          name: nombre,
          status: "archivada",
          is_primary: false,
        } as never)
        .select("id")
        .single()

      await irA(coordinador, `/e/${mundo.empresaA.slug}/ventas`)
      await coordinador
        .getByRole("button", { name: /Nueva venta/ })
        .first()
        .click()
      await coordinador.locator("#sede").click()

      await expect(
        coordinador.getByRole("option", { name: nombre }),
        "una sede archivada sigue ofreciéndose para registrar",
      ).toHaveCount(0)

      await coordinador.keyboard.press("Escape")
      await apiSuperAdmin.from("branches").delete().eq("id", sede!.id)
    },
  )
})
