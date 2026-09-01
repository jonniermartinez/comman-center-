import { crearUsuario } from "../soporte/acciones"
import { abrirDialogo, elegir } from "../soporte/formulario"
import { anotar } from "../soporte/anotaciones"
import { clienteAnonimo, perfilPorEmail } from "../soporte/api"
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
  return `e2e_command_nuevo_${rol}_${Date.now().toString(36)}@jonnier.com`
}

/** Los tres roles, con el texto que los identifica en el desplegable. */
const ROLES = [
  { rol: "asesor" as const, etiqueta: "Asesor", descripcion: "registra lo suyo" },
  {
    rol: "coordinador" as const,
    etiqueta: "Coordinador",
    descripcion: "administra una empresa",
  },
  {
    rol: "super_admin" as const,
    etiqueta: "Super Admin",
    descripcion: "administra la plataforma",
  },
]

/**
 * Abre el menú de acciones de una persona en la lista.
 *
 * Se identifica por su correo y no por su nombre: el correo es único y el
 * nombre no, así que buscando por nombre se podría abrir el menú de otra
 * persona —y aquí las acciones incluyen eliminarla.
 */
async function abrirMenuDe(pagina: import("@playwright/test").Page, correo: string) {
  await irA(pagina, "/admin/usuarios")
  const fila = pagina.getByRole("row").filter({ hasText: correo })
  await expect(fila, `no aparece ${correo} en la lista`).toBeVisible({ timeout: 30_000 })

  // Se reintenta el clic: el botón se pinta en el HTML del servidor pero no
  // responde hasta que React hidrata, y en este despliegue ese hueco es de
  // segundos. Un clic ahí no falla, simplemente no abre nada.
  const boton = fila.getByRole("button", { name: "Acciones" })
  const menu = pagina.getByRole("menu")
  for (let intento = 1; intento <= 4; intento++) {
    await boton.click()
    try {
      await expect(menu).toBeVisible({ timeout: 4_000 })
      return
    } catch {
      if (intento === 4) throw new Error(`El menú de ${correo} no abrió tras 4 clics`)
      await pagina.waitForTimeout(1500)
    }
  }
}

test.describe("Usuarios", () => {
  for (const { rol, descripcion, etiqueta } of ROLES) {
    test(
      `el super admin puede crear un usuario con rol ${rol}`,
      anotar({
        modulo: "Usuarios",
        rol: "super admin",
        tipo: "feature",
        porque:
          `Un ${rol} ${descripcion}. Se hace por la pantalla, que es como se hace de verdad: ` +
          "llamar a la función de la base por debajo probaría el permiso, no el formulario, y " +
          "un campo mal enlazado pasaría desapercibido.",
      }),
      async ({ superAdmin, apiSuperAdmin, rastro }) => {
        const email = correoDePrueba(rol)
        const nombre = `E2E Nuevo ${rol}`

        await irA(superAdmin, "/admin/usuarios")
        await abrirDialogo(superAdmin, /Nuevo usuario/, /Nuevo usuario/)

        await superAdmin.locator("#nombre").fill(nombre)
        await superAdmin.locator("#email").fill(email)
        await elegir(superAdmin, "rol", etiqueta)

        await superAdmin.getByRole("button", { name: /Crear e invitar/ }).click()

        // La cuenta tiene que existir con el rol que se eligió en el
        // desplegable. Se espera a la base y no al aviso de pantalla: el aviso
        // puede salir en rojo porque el correo de invitación no salga —el
        // remitente de Supabase va limitado— y la cuenta estar creada igual.
        await expect
          .poll(async () => (await perfilPorEmail(apiSuperAdmin, email))?.role, {
            timeout: 30_000,
            message: `no apareció la cuenta ${email} tras crearla desde la pantalla`,
          })
          .toBe(rol)

        const perfil = await perfilPorEmail(apiSuperAdmin, email)
        rastro.anotarUsuario(perfil!.id)
        expect(perfil!.status, "una cuenta invitada nace invitada").toBe("invitado")

        // Y se comprueba recargando la pantalla, que es donde lo ve la persona
        // que acaba de crearla: que esté en la base pero no salga en la lista
        // es un fallo igual de real, y no se detecta mirando solo la base.
        await irA(superAdmin, "/admin/usuarios")
        const fila = superAdmin.getByRole("row").filter({ hasText: email })
        await expect(fila, `${email} no aparece en la lista tras recargar`).toBeVisible({
          timeout: 30_000,
        })
        await expect(fila, "la lista no muestra el nombre que se escribió").toContainText(
          nombre,
        )
        await expect(fila, "la lista no muestra que está invitado").toContainText(/Invitad/i)

        // Y se elimina desde la propia pantalla, cerrando el ciclo.
        await abrirMenuDe(superAdmin, email)
        await superAdmin.getByRole("menuitem", { name: /Eliminar usuario/ }).click()
        await superAdmin
          .getByRole("alertdialog")
          .getByRole("button", { name: /Eliminar usuario/ })
          .click()

        await expect
          .poll(async () => (await perfilPorEmail(apiSuperAdmin, email))?.status, {
            timeout: 30_000,
            message: "el usuario no quedó eliminado tras usar el menú",
          })
          .toBe("eliminado")
      },
    )
  }

  test(
    "avisa cuando el correo ya está en uso, en vez de fallar en silencio",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "feature",
      porque:
        "Que no haya dos cuentas con el mismo correo lo garantiza un índice único de la " +
        "base, no la aplicación: comprobarlo sería probar Postgres. Lo que sí puede fallar " +
        "—y dejar a alguien creyendo que dio de alta a una persona que no existe— es que la " +
        "pantalla se lo calle o, peor, diga que salió bien.",
    }),
    async ({ superAdmin, apiSuperAdmin, rastro }) => {
      // La primera cuenta se crea por la vía rápida: aquí no se prueba el alta,
      // que ya tiene sus pruebas, sino qué pasa al repetir el correo.
      const ocupante = await crearUsuario(apiSuperAdmin, rastro, "asesor")

      await irA(superAdmin, "/admin/usuarios")
      await abrirDialogo(superAdmin, /Nuevo usuario/, /Nuevo usuario/)
      await superAdmin.locator("#nombre").fill("E2E Correo Ocupado")
      await superAdmin.locator("#email").fill(ocupante.email)
      await superAdmin.getByRole("button", { name: /Crear e invitar/ }).click()

      // Tiene que decirlo, y decir por qué.
      await expect(
        superAdmin.getByText(/ya existe/i),
        "la pantalla no avisó de que el correo ya estaba en uso",
      ).toBeVisible({ timeout: 30_000 })

      // Y no puede aparecer un aviso de éxito: eso es lo que dejaría a alguien
      // pensando que la persona quedó dada de alta.
      await expect(
        superAdmin.getByText(/creado/i),
        "la pantalla dijo que se creó una cuenta que no se creó",
      ).toHaveCount(0)

      // El nombre de la cuenta que ya existía no se toca: si el alta repetida
      // hubiera pisado la fila, la persona original cambiaría de nombre.
      const perfil = await perfilPorEmail(apiSuperAdmin, ocupante.email)
      expect(perfil!.full_name, "el alta repetida pisó la cuenta que ya existía").toBe(
        ocupante.nombre,
      )
    },
  )

  test(
    "un correo mal escrito no deja crear la cuenta",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "integridad",
      porque:
        "El formulario tiene que frenarlo antes de enviarlo. Una cuenta con un correo " +
        "inválido no puede recibir su invitación: nace muerta y ocupa sitio en la lista.",
    }),
    async ({ superAdmin }) => {
      await irA(superAdmin, "/admin/usuarios")
      await abrirDialogo(superAdmin, /Nuevo usuario/, /Nuevo usuario/)
      await superAdmin.locator("#nombre").fill("E2E Correo Inválido")

      const crear = superAdmin.getByRole("button", { name: /Crear e invitar/ })
      for (const malo of ["sin-arroba", "@sin-nombre.com", "sin espacio@dominio"]) {
        await superAdmin.locator("#email").fill(malo)
        await expect(crear, `el formulario aceptó el correo "${malo}"`).toBeDisabled()
      }

      // Y con uno bien escrito sí deja continuar: si no, la prueba pasaría
      // aunque el botón estuviera roto y nunca se habilitara.
      await superAdmin.locator("#email").fill(correoDePrueba("valido"))
      await expect(crear, "no se habilitó con un correo correcto").toBeEnabled()
    },
  )
})

/**
 * Los cinco botones del menú de cada usuario.
 *
 * Es la pantalla desde la que se da y se quita el acceso a todo el sistema, y
 * cada opción hace algo que no se puede deshacer solo con volver atrás. Se
 * prueban por la interfaz, que es como se usan, y se comprueba el efecto en la
 * base: que el diálogo se cierre no significa que haya pasado nada.
 */
test.describe("Acciones sobre un usuario", () => {
  test(
    "un super admin puede crear otro super admin y luego eliminarlo",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "feature",
      porque:
        "Es el ciclo completo del rol con más poder del sistema, y el único que no puede " +
        "crear nadie de fuera. Si crear al segundo falla, no hay relevo posible; si " +
        "eliminarlo falla, queda una cuenta con acceso total que nadie quería.",
    }),
    // Este va por la base a propósito: lo que se comprueba es el ciclo del rol
    // —crear el segundo super admin y luego quitarlo— y purgar de verdad una
    // cuenta no es algo que la pantalla ofrezca, porque para una persona real
    // la baja es lógica y conserva el histórico.
    async ({ apiSuperAdmin }) => {
      const email = correoDePrueba("relevo")

      const { data: id, error } = await apiSuperAdmin.rpc("admin_create_user", {
        p_email: email,
        p_full_name: "E2E Segundo Super Admin",
        p_role: "super_admin",
      })
      expect(error, `no se pudo crear el segundo super admin: ${error?.message}`).toBeNull()

      const creado = await perfilPorEmail(apiSuperAdmin, email)
      expect(creado!.role, "el segundo no nació super admin").toBe("super_admin")

      // Y se va, sin dejar rastro en la lista de usuarios del cliente.
      const { error: alBorrar } = await apiSuperAdmin.rpc("purge_test_user", {
        target_user: id as string,
      })
      expect(
        alBorrar,
        `no se pudo eliminar el segundo super admin: ${alBorrar?.message}`,
      ).toBeNull()

      const despues = await perfilPorEmail(apiSuperAdmin, email)
      expect(despues, "el segundo super admin sigue existiendo").toBeNull()
    },
  )

  test(
    "el botón Cambiar correo cambia el correo sin romper el histórico",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "feature",
      porque:
        "Es lo que se hace cuando llega el correo real de alguien que entró con uno " +
        "provisional. No puede cambiar el identificador de la cuenta: si lo cambiara, esa " +
        "persona perdería de golpe todo lo que tiene registrado a su nombre.",
    }),
    async ({ superAdmin, apiSuperAdmin, rastro }) => {
      const cuenta = await crearUsuario(apiSuperAdmin, rastro, "asesor", { conAcceso: true })

      const nuevo = correoDePrueba("correo_nuevo")

      await abrirMenuDe(superAdmin, cuenta.email)
      await superAdmin.getByRole("menuitem", { name: /Cambiar correo/ }).click()
      await superAdmin.locator("#correo-nuevo").fill(nuevo)
      await superAdmin
        .getByRole("dialog")
        .getByRole("button", { name: /Cambiar correo/ })
        .click()

      await expect
        .poll(async () => (await perfilPorEmail(apiSuperAdmin, nuevo))?.id, { timeout: 30_000 })
        .toBe(cuenta.id)
    },
  )

  test(
    "el botón Restablecer contraseña entrega una clave nueva que sirve",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "feature",
      porque:
        "Hace falta mientras haya cuentas con correo provisional: no pueden recuperar la " +
        "clave por email porque ese buzón no existe. Si la clave que muestra no sirve, la " +
        "persona se queda fuera y nadie se entera hasta que lo intenta.",
    }),
    async ({ superAdmin, apiSuperAdmin, rastro }) => {
      const cuenta = await crearUsuario(apiSuperAdmin, rastro, "asesor", { conAcceso: true })

      await abrirMenuDe(superAdmin, cuenta.email)
      await superAdmin.getByRole("menuitem", { name: /Restablecer contraseña/ }).click()

      // No abre diálogo: copia al portapapeles y enseña la clave en un aviso.
      // Es la única vez que se ve, así que de ahí hay que leerla.
      const aviso = superAdmin.getByText(/No se vuelve a mostrar/)
      await expect(aviso, "no apareció el aviso con la clave nueva").toBeVisible({
        timeout: 30_000,
      })

      const texto = await aviso.innerText()
      const nueva = texto.match(/→\s*(\S+?)\./)?.[1]
      expect(nueva, `no se pudo leer la clave del aviso: "${texto}"`).toBeTruthy()
      expect(nueva, "la clave nueva es la misma de antes").not.toBe(cuenta.password)

      // Lo que de verdad importa: que con esa clave se pueda entrar.
      const { error } = await clienteAnonimo().auth.signInWithPassword({
        email: cuenta.email,
        password: nueva!,
      })
      expect(error, `la clave que entregó la pantalla no sirve: ${error?.message}`).toBeNull()
    },
  )

  test(
    "el botón Suspender corta el acceso, y Activar lo devuelve",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "seguridad",
      porque:
        "Suspender es lo que se usa cuando alguien deja la empresa de un día para otro. " +
        "Tiene que cortar el acceso de verdad —en la base, no solo en el menú— y poder " +
        "deshacerse si fue un error.",
    }),
    async ({ superAdmin, apiSuperAdmin, rastro }) => {
      const cuenta = await crearUsuario(apiSuperAdmin, rastro, "asesor", { conAcceso: true })

      await abrirMenuDe(superAdmin, cuenta.email)
      await superAdmin.getByRole("menuitem", { name: /Suspender acceso/ }).click()
      await expect
        .poll(async () => (await perfilPorEmail(apiSuperAdmin, cuenta.email))?.status, {
          timeout: 30_000,
          message: "la suspensión no llegó al perfil",
        })
        .toBe("inactivo")

      // Y se puede deshacer, que es lo que la hace usable sin miedo.
      await abrirMenuDe(superAdmin, cuenta.email)
      await superAdmin.getByRole("menuitem", { name: /^Activar/ }).click()
      await expect
        .poll(async () => (await perfilPorEmail(apiSuperAdmin, cuenta.email))?.status, {
          timeout: 30_000,
          message: "no se pudo reactivar",
        })
        .toBe("activo")
    },
  )

  test(
    "el botón Eliminar usuario revoca el acceso y conserva el histórico",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "integridad",
      porque:
        "Eliminar a una persona no puede borrar lo que registró: los informes del año " +
        "pasado tienen que seguir cuadrando y diciendo su nombre. Por eso es baja lógica y " +
        "no un borrado.",
    }),
    async ({ superAdmin, apiSuperAdmin, rastro }) => {
      const cuenta = await crearUsuario(apiSuperAdmin, rastro, "asesor", { conAcceso: true })

      await abrirMenuDe(superAdmin, cuenta.email)
      await superAdmin.getByRole("menuitem", { name: /Eliminar usuario/ }).click()
      // Pide confirmación: es lo que evita llevarse a alguien de un clic.
      await superAdmin
        .getByRole("alertdialog")
        .getByRole("button", { name: /Eliminar usuario/ })
        .click()

      await expect
        .poll(async () => (await perfilPorEmail(apiSuperAdmin, cuenta.email))?.status, {
          timeout: 30_000,
          message: "el borrado no llegó al perfil",
        })
        .toBe("eliminado")

      const perfil = await perfilPorEmail(apiSuperAdmin, cuenta.email)
      expect(perfil, "la fila desapareció; tenía que quedarse marcada").toBeTruthy()
      expect(perfil!.deleted_at, "no quedó constancia de cuándo se eliminó").toBeTruthy()
    },
  )

  test(
    "las cinco acciones están disponibles en el menú",
    anotar({
      modulo: "Usuarios",
      rol: "super admin",
      tipo: "feature",
      porque:
        "Cada una hace algo que no se deshace volviendo atrás. Que falte una en el menú " +
        "significa que esa gestión hay que hacerla a mano en la base.",
    }),
    async ({ superAdmin, apiSuperAdmin, rastro }) => {
      const cuenta = await crearUsuario(apiSuperAdmin, rastro, "asesor", { conAcceso: true })
      await abrirMenuDe(superAdmin, cuenta.email)

      for (const opcion of [
        /Editar y asignar empresas/,
        /Cambiar correo/,
        /Restablecer contraseña/,
        /Suspender acceso|Activar/,
        /Eliminar usuario/,
      ]) {
        await expect(
          superAdmin.getByRole("menuitem", { name: opcion }),
          `falta la opción ${opcion} en el menú`,
        ).toBeVisible()
      }
    },
  )
})
