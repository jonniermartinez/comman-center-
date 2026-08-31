import { capacidadesDe } from "../soporte/matriz"
import { PAGO } from "../soporte/registros"
import { test } from "../soporte/fixtures"
import { anotar } from "../soporte/anotaciones"
import { empresaPorSlug } from "../soporte/api"
import { HOY, marca } from "../soporte/datos"
import { EMPRESA_A } from "../soporte/entorno"
import { expect } from "../soporte/fixtures"
import {
  abrirDialogo,
  abrirDialogoDe,
  abrirModulo,
  elegirPrimera,
  guardar,
  rellenar,
} from "../soporte/formulario"

/** Pagos: los abonos de una venta. */
test.describe("Pagos", () => {
  for (const caso of capacidadesDe(PAGO)) {
    test(caso.titulo, caso.ficha, caso.prueba)
  }
})

test.describe("Pagos por la pantalla", () => {
  test(
    "registrar un pago lo cuelga de su venta",
    anotar({
      modulo: "Pagos",
      rol: "coordinador",
      tipo: "integridad",
      porque:
        "Un pago suelto no cuadra con nada. Lo que lo hace útil es el vínculo con la venta, " +
        "que es de donde sale el saldo pendiente de cada cliente.",
    }),
    async ({ coordinador, apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)
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

      // La venta a la que abonar se crea por API: lo que se prueba aquí es el
      // pago, no otra vez el alta de venta.
      const cliente = marca("pago-cliente")
      const { data: venta } = await apiSuperAdmin
        .from("sales")
        .insert({
          company_id: empresa!.id,
          branch_id: sede!.id,
          staff_id: persona!.id,
          report_date: HOY,
          period_month: `${HOY.slice(0, 7)}-01`,
          licencia_nombre: cliente,
          valor_final: 2000000,
        } as never)
        .select("id")
        .single()

      await abrirModulo(coordinador, EMPRESA_A, "pagos")
      await abrirDialogo(coordinador, /Registrar pago/, /Registrar pago/)

      await coordinador.locator("#buscar").fill(cliente)
      await coordinador.getByText(cliente).first().click()
      await rellenar(coordinador, {
        fecha: HOY,
        monto: "750000",
        recibo: "REC-001",
      })
      await elegirPrimera(coordinador, "medio")
      await guardar(coordinador, /Guardar|Registrar/)

      const { data: pago } = await apiSuperAdmin
        .from("payments")
        .select("id, amount, sale_id")
        .eq("sale_id", venta!.id)
        .maybeSingle()

      expect(pago, "el pago no se guardó").toBeTruthy()
      expect(Number(pago!.amount)).toBe(750000)
      expect(pago!.sale_id, "el pago quedó suelto, sin venta").toBe(venta!.id)

      await apiSuperAdmin.from("payments").delete().eq("id", pago!.id)
      await apiSuperAdmin.from("sales").delete().eq("id", venta!.id)
    },
  )
})
