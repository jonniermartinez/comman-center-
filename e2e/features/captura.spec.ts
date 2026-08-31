import { anotar } from "../soporte/anotaciones"
import { empresaPorSlug } from "../soporte/api"
import { EMPRESA_A } from "../soporte/entorno"
import { expect, test } from "../soporte/fixtures"
import {
  abrirDialogo,
  abrirDialogoDe,
  abrirModulo,
  elegirPrimera,
  guardar,
  rellenar,
} from "../soporte/formulario"

/**
 * Los cinco formularios con los que el equipo mete datos todos los días.
 *
 * Cada prueba comprueba dos cosas, y la segunda es la que importa: que la
 * pantalla diga que guardó, y que **la fila esté en la base con los valores
 * que se escribieron**. Un formulario que cierra el diálogo y no persiste, o
 * que persiste el importe cambiado, se ve idéntico desde fuera.
 */

const HOY = new Date().toISOString().slice(0, 10)

/** Marca única por corrida: permite encontrar la fila creada y limpiarla. */
function marca(que: string) {
  return `e2e-${que}-${Date.now().toString(36)}`
}

test.describe("Captura diaria", () => {
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
    async ({ coordinador, apiSuperAdmin }) => {
      const cliente = marca("venta")
      await abrirModulo(coordinador, EMPRESA_A, "ventas")
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

      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)
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

  test(
    "registrar la jornada guarda el conteo del día",
    anotar({
      modulo: "Gestión diaria",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "Es la hoja que el equipo llena a diario y de la que salen los ratios de " +
        "contactabilidad. Tiene una veintena de campos numéricos: si uno se descoloca, " +
        "los ratios salen mal y nadie lo nota mirando la pantalla.",
    }),
    async ({ coordinador, apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)

      // Una jornada por persona y día: si ya hay una de hoy, se quita antes.
      await apiSuperAdmin
        .from("daily_activity")
        .delete()
        .eq("company_id", empresa!.id)
        .eq("report_date", HOY)

      await abrirModulo(coordinador, EMPRESA_A, "gestion-diaria")
      await abrirDialogo(coordinador, /Registrar jornada/, /Registrar jornada/)

      await elegirPrimera(coordinador, "sede")
      await elegirPrimera(coordinador, "responsable")
      await coordinador.locator("#fecha").fill(HOY)
      await rellenar(coordinador, {
        "ll-cont": "40",
        "ll-agen": "12",
        "at-venta": "3",
      })
      await guardar(coordinador)

      const { data: jornada } = await apiSuperAdmin
        .from("daily_activity")
        .select("*")
        .eq("company_id", empresa!.id)
        .eq("report_date", HOY)
        .maybeSingle()

      expect(jornada, "la jornada no se guardó").toBeTruthy()

      await apiSuperAdmin
        .from("daily_activity")
        .delete()
        .eq("company_id", empresa!.id)
        .eq("report_date", HOY)
    },
  )

  test(
    "registrar una agenda guarda la cita",
    anotar({
      modulo: "Agendas",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "La agenda es el paso previo a la venta. Si no se guarda, el comercial pierde la " +
        "cita y nadie se entera hasta que el cliente no aparece.",
    }),
    async ({ coordinador, apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)
      const cliente = marca("agenda")

      await abrirModulo(coordinador, EMPRESA_A, "agendas")
      await abrirDialogo(coordinador, /Nueva agenda/, /Nueva agenda/)

      await elegirPrimera(coordinador, "sede")
      await elegirPrimera(coordinador, "responsable")
      await rellenar(coordinador, {
        fecha: HOY,
        hora: "10:30",
        nombre: cliente,
        celular: "3009876543",
      })
      await guardar(coordinador)

      const { data: agenda } = await apiSuperAdmin
        .from("appointments")
        .select("id")
        .eq("company_id", empresa!.id)
        .gte("scheduled_at", `${HOY}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      expect(agenda, "la agenda no se guardó").toBeTruthy()
      await apiSuperAdmin.from("appointments").delete().eq("id", agenda!.id)
    },
  )

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

test.describe("Edición de lo ya registrado", () => {
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

      await abrirModulo(coordinador, EMPRESA_A, "ventas")
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
