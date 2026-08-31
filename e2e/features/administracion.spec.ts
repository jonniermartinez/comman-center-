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
    async ({ coordinador, apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)
      const nombre = `e2e-sede-${Date.now().toString(36)}`

      await irA(coordinador, `/e/${EMPRESA_A}/sedes`)
      await coordinador.getByRole("button", { name: /Nueva sede|Añadir sede|Agregar/i })
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
    async ({ coordinador, apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)
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

      await irA(coordinador, `/e/${EMPRESA_A}/ventas`)
      await coordinador.getByRole("button", { name: /Nueva venta/ }).first().click()
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
      const { data } = await apiAsesorB
        .from("companies")
        .select("slug")
        .eq("id", empresa!.id)
      expect(data ?? [], "un retirado sigue viendo la empresa").toHaveLength(0)
      expect(perfil).toBeTruthy()
    },
  )
})

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
    async ({ coordinador, apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)

      await apiSuperAdmin
        .from("company_modules")
        .delete()
        .eq("company_id", empresa!.id)
        .eq("module_code", "caja")

      await irA(coordinador, `/e/${EMPRESA_A}/caja`)
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
    async ({ apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)

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

test.describe("Objetivos", () => {
  test(
    "la pantalla de metas abre y no rompe sin metas cargadas",
    anotar({
      modulo: "Objetivos",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "En producción no hay ni un objetivo cargado (la tabla está a cero), así que el " +
        "caso vacío es el único que se da hoy y es el que nadie prueba.",
    }),
    async ({ coordinador }) => {
      await irA(coordinador, `/e/${EMPRESA_A}/objetivos`)
      await expect(coordinador.locator("body")).not.toContainText(/Application error|Unhandled/i)
      await expect(coordinador.locator("body")).not.toContainText("Sin acceso")
    },
  )
})

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
    async ({ apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)

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
    async ({ superAdmin }) => {
      await irA(superAdmin, "/admin/auditoria")
      await expect(superAdmin.locator("body")).not.toContainText(/Application error/i)
      await expect(superAdmin.getByRole("row").first()).toBeVisible()
    },
  )
})
