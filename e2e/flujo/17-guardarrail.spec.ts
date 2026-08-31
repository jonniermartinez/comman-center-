import { anotar } from "../soporte/anotaciones"
import { borrarEmpresa, empresaPorSlug } from "../soporte/api"
import { EMPRESAS_REALES } from "../soporte/entorno"
import { DatoProtegido, esDePrueba, exigirDePrueba } from "../soporte/guardarrail"
import { expect, test } from "../soporte/fixtures"

/**
 * Que las pruebas no puedan tocar los datos del cliente.
 *
 * Las demás pruebas comprueban la aplicación; estas comprueban **las pruebas**.
 * Corren contra producción, donde viven 16.500 ventas y 19.000 pagos reales sin
 * copia de seguridad, así que la promesa de "solo tocan lo suyo" no puede ser
 * una costumbre: tiene que ser algo que falle en rojo si alguien la rompe.
 */

test.describe("Guardarraíl de las pruebas", () => {
  test(
    "no se puede borrar ninguna de las empresas reales del cliente",
    anotar({
      modulo: "Empresas",
      tipo: "seguridad",
      porque:
        "Es la garantía de la que cuelga todo lo demás. Si esta falla, la suite entera es " +
        "peligrosa y hay que pararla antes de que borre algo del cliente.",
    }),
    async ({ apiSuperAdmin }) => {
      for (const real of EMPRESAS_REALES) {
        // Se llama al mismo camino que usa la limpieza, con la sesión que más
        // permisos tiene. Si algo puede llevarse una empresa real, es esto.
        await expect(
          borrarEmpresa(apiSuperAdmin, real),
          `¡el guardarraíl dejó pasar el borrado de ${real}!`,
        ).rejects.toThrow(DatoProtegido)

        // Y sigue ahí, que es lo que de verdad importa.
        const sigue = await empresaPorSlug(apiSuperAdmin, real)
        expect(sigue, `la empresa ${real} ya no existe`).toBeTruthy()
      }
    },
  )

  test(
    "solo se reconoce como de prueba lo que lleva el prefijo",
    anotar({
      modulo: "Empresas",
      tipo: "seguridad",
      porque:
        "El prefijo es el único criterio por el que se acepta destruir algo. Un fallo aquí " +
        "—que reconociera de más— convertiría el guardarraíl en decorado.",
    }),
    async () => {
      for (const deVerdad of [...EMPRESAS_REALES, "CEA", "Trámites", "", "  ", "empresa-e2e"]) {
        expect(esDePrueba(deVerdad), `"${deVerdad}" se tomó por dato de prueba`).toBe(false)
      }
      for (const dePrueba of ["e2e-sandbox-a", "E2E-Sandbox-B", "e2e-venta-abc"]) {
        expect(esDePrueba(dePrueba), `"${dePrueba}" no se reconoció como prueba`).toBe(true)
      }
    },
  )

  test(
    "el guardarraíl salta antes de tocar nada, no después",
    anotar({
      modulo: "Empresas",
      tipo: "seguridad",
      porque:
        "Comprobar después de borrar no sirve de nada. La excepción tiene que impedir la " +
        "operación, no informar de ella.",
    }),
    async () => {
      expect(() => exigirDePrueba("borrar", "cea")).toThrow(DatoProtegido)
      expect(() => exigirDePrueba("borrar", "Empresa Cliente")).toThrow(DatoProtegido)
      expect(() => exigirDePrueba("borrar", null)).toThrow(DatoProtegido)
      expect(() => exigirDePrueba("borrar", "e2e-loquesea")).not.toThrow()
    },
  )

  test(
    "una prueba estrena su propia empresa y se la lleva al terminar",
    anotar({
      modulo: "Empresas",
      tipo: "integridad",
      porque:
        "Es la alternativa a compartir el banco de pruebas: cada prueba que escribe de " +
        "verdad monta su empresa ficticia y al acabar se borra entera, con todo lo de dentro. " +
        "Así no hay forma de que un registro sobreviva a la prueba que lo creó.",
    }),
    async ({ empresaPropia, apiSuperAdmin }) => {
      expect(esDePrueba(empresaPropia.slug), "la empresa propia no lleva prefijo").toBe(true)

      const existe = await empresaPorSlug(apiSuperAdmin, empresaPropia.slug)
      expect(existe, "la empresa propia no se creó").toBeTruthy()
      expect(existe!.id).toBe(empresaPropia.companyId)

      // Que desaparece al terminar lo comprueba la prueba siguiente: aquí no se
      // puede, porque el desmontaje del fixture corre después de este cuerpo.
    },
  )

  test(
    "no queda ninguna empresa de prueba huérfana de corridas anteriores",
    anotar({
      modulo: "Empresas",
      tipo: "integridad",
      porque:
        "Si una corrida anterior dejó empresas a medias, aparecen en la pantalla de inicio " +
        "del cliente mezcladas con las suyas. Ya pasó, y es exactamente lo que estas pruebas " +
        "no pueden permitirse.",
    }),
    async ({ apiSuperAdmin }) => {
      const { data: todas } = await apiSuperAdmin.from("companies").select("slug, created_at")
      const sobras = (todas ?? []).filter(
        (c) => esDePrueba(c.slug) && !c.slug.startsWith("e2e-sandbox"),
      )

      expect(
        sobras.map((c) => c.slug),
        "quedaron empresas de prueba de corridas anteriores",
      ).toEqual([])
    },
  )
})
