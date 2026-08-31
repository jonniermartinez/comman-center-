import { capacidadesDe } from "../soporte/matriz"
import { CAJA } from "../soporte/registros"
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

/**
 * Caja: el dinero físico del punto.
 *
 * Es el único módulo donde el comercial no llega a nada: crear, corregir y
 * borrar son solo de quien administra. La matriz lo sabe por su marca
 * `soloAdmin` y genera las pruebas que corresponden.
 */
test.describe("Caja", () => {
  for (const caso of capacidadesDe(CAJA)) {
    test(caso.titulo, caso.ficha, caso.prueba)
  }
})

test.describe("Caja por la pantalla", () => {
  test(
    "registrar un movimiento de caja guarda el importe",
    anotar({
      modulo: "Caja",
      rol: "coordinador",
      tipo: "integridad",
      porque:
        "Es dinero físico del punto y quien responde por él es quien administra. " +
        "Un importe mal guardado es un descuadre que alguien tiene que explicar.",
    }),
    async ({ coordinador, apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)
      const quien = marca("caja")

      await abrirModulo(coordinador, EMPRESA_A, "caja")
      await abrirDialogo(coordinador, /Nuevo movimiento/, /Nuevo movimiento/)

      await elegirPrimera(coordinador, "sede")
      await elegirPrimera(coordinador, "concepto")
      await rellenar(coordinador, {
        fecha: HOY,
        nombre: quien,
        monto: "250000",
      })
      await guardar(coordinador)

      const { data: movimiento } = await apiSuperAdmin
        .from("cash_movements")
        .select("id, amount")
        .eq("company_id", empresa!.id)
        .eq("report_date", HOY)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      expect(movimiento, "el movimiento no se guardó").toBeTruthy()
      expect(Number(movimiento!.amount)).toBe(250000)

      await apiSuperAdmin.from("cash_movements").delete().eq("id", movimiento!.id)
    },
  )
})
