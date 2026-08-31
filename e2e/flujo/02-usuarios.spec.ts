import { anotar } from "../soporte/anotaciones"
import { perfilPorEmail } from "../soporte/api"
import { CUENTAS } from "../soporte/entorno"
import { expect, test } from "../soporte/fixtures"
import { irA } from "../soporte/reintento"

/**
 * Crear las cuentas. Lo segundo que ocurre en el sistema: sin usuarios no hay
 * quien cree empresas ni quien registre nada.
 *
 * Las cuentas se crean con `admin_create_user`, una función de Postgres que
 * vuelve a comprobar que quien la llama es super admin. No hay clave de
 * servicio de por medio, así que la base es la puerta, no la pantalla.
 */

/** Un correo que no choca con nadie y que se limpia al terminar. */
function correoDePrueba(rol: string) {
  return `e2e_nuevo_${rol}_${Date.now().toString(36)}@jonnier.com`
}

const ROLES = [
  { rol: "asesor" as const, descripcion: "registra lo suyo" },
  { rol: "coordinador" as const, descripcion: "administra una empresa" },
  { rol: "super_admin" as const, descripcion: "administra la plataforma" },
]

test.describe("Usuarios", () => {
  for (const { rol, descripcion } of ROLES) {
    test(
      `el super admin puede crear un usuario con rol ${rol}`,
      anotar({
        modulo: "Usuarios",
        rol: "super admin",
        tipo: "feature",
        porque:
          `Un ${rol} ${descripcion}. Si el alta con ese rol se rompe, no hay forma de meter ` +
          "gente nueva al sistema y no se nota hasta que alguien lo intenta.",
      }),
      async ({ apiSuperAdmin }) => {
        const email = correoDePrueba(rol)

        const { data: id, error } = await apiSuperAdmin.rpc("admin_create_user", {
          p_email: email,
          p_full_name: `E2E Nuevo ${rol}`,
          p_role: rol,
        })
        expect(error, `no se pudo crear un ${rol}: ${error?.message}`).toBeNull()
        expect(id, "la base no devolvió el identificador de la cuenta").toBeTruthy()

        // El perfil lo crea un trigger a partir de la cuenta de Auth: si no
        // aparece, la cuenta existe pero es inservible.
        const perfil = await perfilPorEmail(apiSuperAdmin, email)
        expect(perfil, "la cuenta se creó sin perfil").toBeTruthy()
        expect(perfil!.role, "el rol no es el que se pidió").toBe(rol)
        expect(perfil!.status, "una cuenta nueva nace invitada").toBe("invitado")

        // No se puede borrar de verdad —es baja lógica— así que se revoca.
        await apiSuperAdmin.rpc("soft_delete_user", { target_user: id as string })
      },
    )
  }

  test(
    "no se puede crear dos usuarios con el mismo correo",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "integridad",
      porque:
        "El correo es con lo que se entra. Dos cuentas con el mismo dejarían el acceso a " +
        "suertes según cuál resuelva primero.",
    }),
    async ({ apiSuperAdmin }) => {
      const email = correoDePrueba("repetido")

      const { data: id } = await apiSuperAdmin.rpc("admin_create_user", {
        p_email: email,
        p_full_name: "E2E Repetido",
        p_role: "asesor",
      })

      const { error } = await apiSuperAdmin.rpc("admin_create_user", {
        p_email: email,
        p_full_name: "E2E Repetido Otra Vez",
        p_role: "asesor",
      })
      expect(error, "se crearon dos cuentas con el mismo correo").toBeTruthy()

      await apiSuperAdmin.rpc("soft_delete_user", { target_user: id as string })
    },
  )

  test(
    "un correo mal escrito no crea cuenta",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "integridad",
      porque:
        "Una cuenta con un correo inválido no puede recibir su invitación: nace muerta y " +
        "ocupa sitio en la lista de usuarios.",
    }),
    async ({ apiSuperAdmin }) => {
      for (const malo of ["sin-arroba", "@sin-nombre.com", "sin punto@dominio", ""]) {
        const { error } = await apiSuperAdmin.rpc("admin_create_user", {
          p_email: malo,
          p_full_name: "E2E Inválido",
          p_role: "asesor",
        })
        expect(error, `se aceptó el correo "${malo}"`).toBeTruthy()
      }
    },
  )

  test(
    "el super admin ve la administración de usuarios",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "feature",
      porque: "Es la pantalla desde la que se da y se quita el acceso a todo el sistema.",
    }),
    async ({ superAdmin }) => {
      await irA(superAdmin, "/admin/usuarios")
      await expect(superAdmin).toHaveURL(/\/admin\/usuarios/)
      await expect(superAdmin.locator("body")).not.toContainText("Sin acceso")
      // Las cuentas de prueba tienen que verse: si no, la lista no está cargando.
      await expect(superAdmin.locator("body")).toContainText(CUENTAS.coordinador.email)
    },
  )
})
