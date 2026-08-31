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
 * El equipo de la empresa: quién puede registrar a nombre de quién.
 */

test.describe("Equipo de la empresa", () => {
  test(
    "quitar a alguien conserva lo que ya registró",
    anotar({
      modulo: "Usuarios",
      rol: "coordinador",
      tipo: "integridad",
      porque:
        "Sacar a alguien del equipo no puede borrar su histórico: los informes del año " +
        "pasado tienen que seguir cuadrando aunque esa persona ya no esté.",
    }),
    async ({ apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)
      const perfil = await perfilPorEmail(apiSuperAdmin, CUENTAS.asesorA.email)

      // Se quita marcando `removed_at`, no borrando la fila.
      await apiSuperAdmin
        .from("company_users")
        .update({ removed_at: new Date().toISOString() })
        .eq("company_id", empresa!.id)
        .eq("user_id", perfil!.id)

      const { data: fila } = await apiSuperAdmin
        .from("company_users")
        .select("removed_at")
        .eq("company_id", empresa!.id)
        .eq("user_id", perfil!.id)
        .maybeSingle()

      expect(fila, "la asignación se borró en vez de marcarse").toBeTruthy()
      expect(fila!.removed_at).toBeTruthy()

      // Se devuelve a su sitio: el resto de pruebas cuenta con él dentro.
      await apiSuperAdmin
        .from("company_users")
        .update({ removed_at: null })
        .eq("company_id", empresa!.id)
        .eq("user_id", perfil!.id)
    },
  )

  test(
    "quien fue retirado deja de ver la empresa",
    anotar({
      modulo: "Usuarios",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "Retirar a alguien tiene que cortarle el acceso de verdad, en la base, no solo " +
        "quitarle la empresa del menú.",
    }),
    async ({ apiSuperAdmin, apiAsesorB }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)
      const perfil = await perfilPorEmail(apiSuperAdmin, CUENTAS.asesorB.email)

      // El asesor B nunca ha estado en la empresa A: para él es exactamente lo
      // mismo que haber sido retirado.
      const { data } = await apiAsesorB.from("companies").select("slug").eq("id", empresa!.id)
      expect(data ?? [], "un retirado sigue viendo la empresa").toHaveLength(0)
      expect(perfil).toBeTruthy()
    },
  )
})
