import { clienteAnonimo, perfilPorEmail } from "../soporte/api"
import {
  BUZON_INVITADO,
  BUZON_RECUPERA,
  esperarCorreo,
  hayBuzon,
  rutaDeConfirmacion,
  vaciarBuzon,
} from "../soporte/correo"
import { expect, test } from "../soporte/fixtures"
import { irA } from "../soporte/reintento"

/**
 * Los dos flujos que dependen de un correo de verdad.
 *
 * Todo lo demás usa cuentas ya confirmadas con contraseña conocida, así que
 * estas son las únicas pruebas que necesitan leer un buzón. Y son justo las que
 * más falta hacen: si la invitación se rompe, nadie nuevo puede entrar al
 * sistema, y eso no se nota hasta que alguien lo intenta.
 *
 * El buzón lo sirve `e2e/correo-worker/`, desplegado en la zona jonnier.com.
 */

test.describe("Flujos por correo", () => {
  test.skip(!hayBuzon(), "Sin E2E_MAIL_URL / E2E_MAIL_SECRET en .env.e2e")
  // El envío pasa por el SMTP de Supabase y por Email Routing; medido en
  // producción, el primer correo puede tardar más de un minuto.
  test.setTimeout(240_000)

  test("recuperar la contraseña llega, canjea y deja entrar", async ({ page }) => {
    await vaciarBuzon(BUZON_RECUPERA)

    await irA(page, "/recuperar")
    await page.locator("#email").fill(BUZON_RECUPERA)
    await page.getByRole("button", { name: /Enviar enlace/ }).click()

    const correo = await esperarCorreo(BUZON_RECUPERA, { asunto: /reset|contrase|password/i })
    expect(correo.tokenHash, `el correo no traía token: ${correo.enlaces.join(" ")}`).toBeTruthy()
    expect(correo.tipo).toBe("recovery")

    // Se canjea por la ruta de la aplicación, que es la que la app espera.
    await irA(page, rutaDeConfirmacion(correo, "/definir-clave"))
    await expect(page, `el enlace no llevó a definir la clave: ${page.url()}`).toHaveURL(
      /definir-clave/,
    )
  })

  test("un enlace ya usado no sirve dos veces", async ({ page }) => {
    await vaciarBuzon(BUZON_RECUPERA)

    await irA(page, "/recuperar")
    await page.locator("#email").fill(BUZON_RECUPERA)
    await page.getByRole("button", { name: /Enviar enlace/ }).click()

    const correo = await esperarCorreo(BUZON_RECUPERA, { asunto: /reset|contrase|password/i })
    const ruta = rutaDeConfirmacion(correo, "/definir-clave")

    // Primer uso: entra.
    await irA(page, ruta)
    await expect(page).toHaveURL(/definir-clave/)

    // Segundo uso, con sesión nueva: el token es de un solo uso y tiene que
    // rebotar al login. Si no, un enlace filtrado sirve para siempre.
    const otro = await page.context().browser()!.newContext()
    const otraPagina = await otro.newPage()
    await otraPagina.goto(`${test.info().project.use.baseURL}${ruta}`)
    await expect(otraPagina, "un enlace de un solo uso funcionó dos veces").toHaveURL(/login/)
    await otro.close()
  })

  test("invitar a alguien le manda un correo con el que puede entrar", async ({
    superAdmin,
    apiSuperAdmin,
  }) => {
    // Si quedó de una corrida anterior, se retira: la invitación exige que la
    // cuenta no exista.
    const previo = await perfilPorEmail(apiSuperAdmin, BUZON_INVITADO)
    if (previo) {
      await apiSuperAdmin.rpc("soft_delete_user", { target_user: previo.id })
    }
    await vaciarBuzon(BUZON_INVITADO)

    await irA(superAdmin, "/admin/usuarios")
    await superAdmin.getByRole("button", { name: /Nuevo usuario|Invitar/i }).first().click()
    await superAdmin.locator("#nombre").fill("E2E Invitado")
    await superAdmin.locator("#email").fill(BUZON_INVITADO)
    await superAdmin.getByRole("button", { name: /Crear|Invitar|Guardar/i }).last().click()

    const correo = await esperarCorreo(BUZON_INVITADO)
    expect(
      correo.tokenHash,
      `la invitación no traía token: ${correo.enlaces.join(" ")}`,
    ).toBeTruthy()

    // El invitado canjea su enlace y aterriza donde define su contraseña.
    const invitado = await superAdmin.context().browser()!.newContext()
    const paginaInvitado = await invitado.newPage()
    await paginaInvitado.goto(
      `${test.info().project.use.baseURL}${rutaDeConfirmacion(correo, "/definir-clave")}`,
    )
    await expect(paginaInvitado, `el invitado no llegó a definir su clave`).toHaveURL(
      /definir-clave/,
    )
    await invitado.close()
  })

  test("pedir recuperación de un correo que no existe no delata nada", async ({ page }) => {
    // Un atacante no debe poder averiguar qué correos tienen cuenta.
    //
    // La dirección va en `.invalid` (RFC 2606) y no en jonnier.com a
    // propósito: una dirección inventada del dominio no tendría regla de
    // enrutamiento y caería en el catch-all de la zona, que reenvía al buzón
    // personal. Las pruebas no mandan correo a nadie de verdad.
    await irA(page, "/recuperar")
    await page.locator("#email").fill("e2e-cc-no-existe@ejemplo.invalid")
    await page.getByRole("button", { name: /Enviar enlace/ }).click()

    await expect(page.locator("body")).not.toContainText(/no existe|not found|sin cuenta/i)

    const anonimo = clienteAnonimo()
    const { data } = await anonimo.from("profiles").select("id").limit(1)
    expect(data ?? []).toHaveLength(0)
  })
})
