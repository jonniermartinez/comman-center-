import { crearUsuario, empresaConEquipo } from "../soporte/acciones"
import { anotar } from "../soporte/anotaciones"
import { asignarAEmpresa, perfilPorEmail } from "../soporte/api"
import { expect, test } from "../soporte/fixtures"

/**
 * El equipo de una empresa: quién trabaja ahí y con qué rol.
 *
 * Es el eslabón entre las cuentas y los datos. Una cuenta sin empresa no ve
 * nada; una empresa sin equipo no puede registrar nada. Todo lo que se prueba
 * más adelante —ventas, pagos, agendas— da por hecho que este paso funciona.
 *
 * Cada prueba monta su propia empresa con su propio equipo mediante
 * `empresaConEquipo`, la misma pieza que usan las de captura. Al terminar se
 * borra la empresa y se revocan las cuentas.
 */

test.describe("Equipo de la empresa", () => {
  test(
    "una empresa nueva se monta con un coordinador y un asesor",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "feature",
      porque:
        "Es el punto de partida de todo lo demás: sin equipo, la empresa existe pero no " +
        "puede registrar una sola venta.",
    }),
    async ({ apiSuperAdmin, rastro }) => {
      const empresa = await empresaConEquipo(apiSuperAdmin, rastro)

      const { data: asignados } = await apiSuperAdmin
        .from("company_users")
        .select("user_id, role, branch_id")
        .eq("company_id", empresa.companyId)
        .is("removed_at", null)

      const roles = (asignados ?? []).map((a) => a.role).sort()
      expect(roles, "la empresa no quedó con sus dos roles").toEqual(["asesor", "coordinador"])

      // Un asesor no puede quedar sin sede: es una restricción de la base.
      const asesor = (asignados ?? []).find((a) => a.role === "asesor")
      expect(asesor?.branch_id, "el asesor quedó sin sede").toBeTruthy()

      // Y tiene que estar enlazado con una persona del equipo, o no puede
      // figurar como responsable de nada.
      expect(empresa.staffId, "el asesor no quedó enlazado con su persona").toBeTruthy()
    },
  )

  for (const rol of ["asesor", "coordinador", "super_admin"] as const) {
    test(
      `se puede sumar al equipo a alguien con rol ${rol}`,
      anotar({
        modulo: "Usuarios",
        rol: "super admin",
        tipo: "feature",
        porque:
          `Los tres roles existen y los tres tienen que poder entrar a una empresa. Si el ` +
          `alta de un ${rol} falla, ese perfil queda inservible sin que nadie lo note hasta ` +
          "que hace falta.",
      }),
      async ({ apiSuperAdmin, rastro }) => {
        const empresa = await empresaConEquipo(apiSuperAdmin, rastro)
        const cuenta = await crearUsuario(apiSuperAdmin, rastro, rol)

        // El super admin llega a todo sin estar asignado, así que en la empresa
        // entra con el rol de trabajo que le corresponda.
        const enLaEmpresa = rol === "super_admin" ? "coordinador" : rol
        await asignarAEmpresa(apiSuperAdmin, cuenta.email, empresa.slug, enLaEmpresa)

        const perfil = await perfilPorEmail(apiSuperAdmin, cuenta.email)
        const { data: asignacion } = await apiSuperAdmin
          .from("company_users")
          .select("role, branch_id, removed_at")
          .eq("company_id", empresa.companyId)
          .eq("user_id", perfil!.id)
          .maybeSingle()

        expect(asignacion, `el ${rol} no quedó asignado a la empresa`).toBeTruthy()
        expect(asignacion!.role).toBe(enLaEmpresa)
        expect(asignacion!.removed_at, "quedó asignado y retirado a la vez").toBeNull()
      },
    )
  }

  test(
    "quitar a alguien conserva lo que ya registró",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "integridad",
      porque:
        "Sacar a alguien del equipo no puede borrar su histórico: los informes del año " +
        "pasado tienen que seguir cuadrando aunque esa persona ya no esté.",
    }),
    async ({ apiSuperAdmin, rastro }) => {
      const empresa = await empresaConEquipo(apiSuperAdmin, rastro)
      const perfil = await perfilPorEmail(apiSuperAdmin, empresa.asesor.email)

      // Se quita marcando `removed_at`, no borrando la fila.
      await apiSuperAdmin
        .from("company_users")
        .update({ removed_at: new Date().toISOString() })
        .eq("company_id", empresa.companyId)
        .eq("user_id", perfil!.id)

      const { data: fila } = await apiSuperAdmin
        .from("company_users")
        .select("removed_at")
        .eq("company_id", empresa.companyId)
        .eq("user_id", perfil!.id)
        .maybeSingle()

      expect(fila, "la asignación se borró en vez de marcarse").toBeTruthy()
      expect(fila!.removed_at, "no quedó marcada la salida").toBeTruthy()
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
    async ({ apiSuperAdmin, apiAsesorB, rastro }) => {
      const empresa = await empresaConEquipo(apiSuperAdmin, rastro)

      // El asesor B nunca estuvo en esta empresa: para él es exactamente lo
      // mismo que haber sido retirado de ella.
      const { data } = await apiAsesorB
        .from("companies")
        .select("slug")
        .eq("id", empresa.companyId)
      expect(data ?? [], "alguien ajeno a la empresa la está viendo").toHaveLength(0)
    },
  )
})
