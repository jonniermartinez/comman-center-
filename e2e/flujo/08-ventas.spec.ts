import { capacidadesDe } from "../soporte/matriz"
import { VENTA } from "../soporte/registros"
import { test } from "../soporte/fixtures"
import { anotar } from "../soporte/anotaciones"
import { empresaPorSlug } from "../soporte/api"
import { HOY, marca } from "../soporte/datos"
import { expect } from "../soporte/fixtures"
import {
  abrirDialogo,
  abrirDialogoDe,
  abrirModulo,
  elegirPrimera,
  guardar,
  rellenar,
} from "../soporte/formulario"

/**
 * Ventas: el registro del que cuelga todo lo demás.
 *
 * Las capacidades —crear, corregir, borrar, y hasta dónde llega cada rol— salen
 * de la matriz compartida, que las define una sola vez para los cinco módulos.
 * Lo propio de ventas que no cabe ahí va debajo.
 */
test.describe("Ventas", () => {
  for (const caso of capacidadesDe(VENTA)) {
    test(caso.titulo, caso.ficha, caso.prueba)
  }
})

test.describe("Ventas por la pantalla", () => {
  test(
    "registrar una venta la guarda con su importe exacto",
    anotar({
      modulo: "Ventas",
      rol: "coordinador",
      tipo: "integridad",
      porque:
        "Es el dato del que cuelga todo lo demás: facturación, recaudo y las metas del mes. " +
        "Si el importe se guarda distinto de lo escrito, los informes mienten sin avisar.",
    }),
    async ({ coordinador, apiSuperAdmin, mundo }) => {
      const cliente = marca("venta")
      await abrirModulo(coordinador, mundo.empresaA.slug, "ventas")
      await abrirDialogo(coordinador, /Nueva venta/, /Nueva venta/)

      await elegirPrimera(coordinador, "sede")
      await elegirPrimera(coordinador, "responsable")
      await rellenar(coordinador, {
        fecha: HOY,
        nombre: cliente,
        documento: "1234567890",
        celular: "3001234567",
        valor: "1500000",
        recaudo: "500000",
      })
      await guardar(coordinador)

      const empresa = await Promise.resolve({ id: mundo.empresaA.companyId })
      const { data: venta } = await apiSuperAdmin
        .from("sales")
        .select("id, licencia_nombre, valor_final, recaudo, report_date")
        .eq("company_id", empresa!.id)
        .eq("licencia_nombre", cliente)
        .maybeSingle()

      expect(venta, "la venta no llegó a la base pese a cerrarse el diálogo").toBeTruthy()
      expect(Number(venta!.valor_final), "el importe guardado no es el escrito").toBe(1500000)
      expect(venta!.report_date).toBe(HOY)

      await apiSuperAdmin.from("sales").delete().eq("id", venta!.id)
    },
  )
})

test.describe("Edición por la pantalla", () => {
  test(
    "editar una venta cambia el dato, no crea otra",
    anotar({
      modulo: "Ventas",
      rol: "coordinador",
      tipo: "regresión",
      porque:
        "Corregir es tan habitual como registrar: se teclea mal un importe y hay que " +
        "arreglarlo. Si editar duplicase, el mes saldría inflado.",
      regresion:
        "El lápiz de edición se añadió en agosto de 2026 (commits 55317ed y 88acf7b) " +
        "en los cinco listados; antes solo se podía crear.",
    }),
    async ({ coordinador, apiSuperAdmin, mundo }) => {
      const empresa = await Promise.resolve({ id: mundo.empresaA.companyId })
      const { data: sede } = await apiSuperAdmin
        .from("branches")
        .select("id")
        .eq("company_id", empresa!.id)
        .eq("is_primary", true)
        .single()
      const { data: persona } = await apiSuperAdmin
        .from("staff")
        .select("id")
        .eq("full_name", "E2E Asesor A")
        .single()

      const cliente = marca("editar")
      const { data: venta } = await apiSuperAdmin
        .from("sales")
        .insert({
          company_id: empresa!.id,
          branch_id: sede!.id,
          staff_id: persona!.id,
          report_date: HOY,
          period_month: `${HOY.slice(0, 7)}-01`,
          licencia_nombre: cliente,
          valor_final: 1000000,
        } as never)
        .select("id")
        .single()

      await abrirModulo(coordinador, mundo.empresaA.slug, "ventas")
      await abrirDialogoDe(
        coordinador,
        coordinador
          .getByRole("button", {
            name: new RegExp(`Editar la venta de ${cliente}`),
          })
          .first(),
        /Editar venta/,
        `el lápiz de ${cliente}`,
      )

      await coordinador.locator("#valor").fill("1750000")
      await guardar(coordinador)

      const { data: todas } = await apiSuperAdmin
        .from("sales")
        .select("id, valor_final")
        .eq("company_id", empresa!.id)
        .eq("licencia_nombre", cliente)

      expect(todas ?? [], "editar duplicó la venta en vez de cambiarla").toHaveLength(1)
      expect(Number(todas![0].valor_final), "el cambio no se guardó").toBe(1750000)

      await apiSuperAdmin.from("sales").delete().eq("id", venta!.id)
    },
  )
})
