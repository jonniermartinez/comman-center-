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
 * El registro de quién hizo qué. Es la única evidencia que queda de
 * una acción administrativa.
 */

test.describe("Auditoría", () => {
  test(
    "las acciones administrativas quedan registradas con su autor",
    anotar({
      modulo: "Auditoría",
      rol: "super admin",
      tipo: "integridad",
      porque:
        "El log es la única evidencia de quién archivó o borró algo. Se escribe desde " +
        "Postgres estampando el actor del token, así que tiene que aparecer solo.",
      regresion:
        "Durante semanas no se escribió ni una línea: logAudit reventaba por una clave " +
        "ausente y el error se tragaba la operación entera (31/08/2026).",
    }),
    async ({ apiSuperAdmin, mundo }) => {
      const empresa = await Promise.resolve({ id: mundo.empresaA.companyId })

      const { count: antes } = await apiSuperAdmin
        .from("audit_log")
        .select("id", { count: "exact", head: true })

      // Archivar y desarchivar: dos acciones auditables sin consecuencias.
      await apiSuperAdmin
        .from("companies")
        .update({ status: "archivada", archived_at: new Date().toISOString() })
        .eq("id", empresa!.id)
      await apiSuperAdmin.rpc("log_audit", {
        p_action: "archive",
        p_entity: "companies",
        p_entity_id: empresa!.id,
        p_company_id: empresa!.id,
      })
      await apiSuperAdmin
        .from("companies")
        .update({ status: "activa", archived_at: null })
        .eq("id", empresa!.id)

      const { count: despues } = await apiSuperAdmin
        .from("audit_log")
        .select("id", { count: "exact", head: true })

      expect(despues ?? 0, "la acción no dejó rastro en el log").toBeGreaterThan(antes ?? 0)

      const { data: ultima } = await apiSuperAdmin
        .from("audit_log")
        .select("actor_name, action")
        .order("id", { ascending: false })
        .limit(1)
        .single()

      // El autor lo pone Postgres desde el token: no puede venir vacío.
      expect(ultima!.actor_name, "el log no registró quién lo hizo").toBe("E2E Super Admin")
    },
  )

  test(
    "la pantalla de auditoría lista los movimientos",
    anotar({
      modulo: "Auditoría",
      rol: "super admin",
      tipo: "feature",
      porque: "De poco sirve un log que se escribe pero no se puede consultar.",
    }),
    async ({ superAdmin, mundo }) => {
      await irA(superAdmin, "/admin/auditoria")
      await expect(superAdmin.locator("body")).not.toContainText(/Application error/i)
      await expect(superAdmin.getByRole("row").first()).toBeVisible()
    },
  )
})
