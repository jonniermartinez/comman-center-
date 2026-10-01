import { Placas, pesos, type Placa } from "@/components/indicadores/rentabilidad-pauta"
import { formatCOPShort } from "@/lib/format"
import { cumplimientoDelMes, diasCorridos } from "@/lib/indicadores"

/**
 * El cumplimiento del mes: lo que la coordinación sacaba de su Excel y no
 * estaba en los indicadores. Dos preguntas, una por fila: si la facturación
 * va a llegar a la meta al ritmo que lleva, y qué pasa con el presupuesto de
 * pauta que falta por invertir.
 *
 * Solo tiene sentido sobre un mes entero y con la facturación de toda la
 * empresa, que es contra lo que se fijan la meta y el presupuesto.
 */
export function CumplimientoMes({
  mes,
  hoy,
  facturacion,
  meta,
  presupuesto,
  invertido,
}: {
  mes: string
  hoy: string
  facturacion: number
  /** La meta de facturación del mes, o null si no se ha fijado en Objetivos. */
  meta: number | null
  presupuesto: number | null
  invertido: number | null
}) {
  const dias = diasCorridos(mes, hoy)
  const c = cumplimientoDelMes({
    facturacion,
    meta,
    presupuesto,
    invertido,
    diasDelMes: dias.delMes,
    diasCorridos: dias.corridos,
  })
  const cerrado = dias.faltantes === 0
  const sinPresupuesto = "Falta el presupuesto autorizado"

  const facturacionCeldas: Placa[] = [
    {
      label: "Facturación actual",
      ...pesos(facturacion),
      hint: `Día ${dias.corridos} de ${dias.delMes}`,
    },
    {
      label: "Meta de facturación",
      ...pesos(meta),
      hint:
        meta === null
          ? "Se fija en Objetivos"
          : c.faltaParaMeta === 0
            ? "Meta cumplida"
            : `Faltan ${formatCOPShort(c.faltaParaMeta!)}`,
    },
    {
      label: "Promedio diario para la meta",
      ...pesos(c.promedioDiarioParaMeta),
      hint:
        meta === null
          ? "(Meta − facturación) ÷ días faltantes"
          : c.faltaParaMeta === 0
            ? "Ya no hace falta vender más para llegar"
            : cerrado
              ? "El mes ya cerró"
              : `En cada uno de los ${dias.faltantes} día(s) que faltan`,
      destacada: true,
    },
    {
      label: "Proyección lineal",
      ...pesos(c.proyeccionLineal),
      hint:
        c.promedioDiario === null
          ? "El mes no ha empezado"
          : `Al ritmo de ${formatCOPShort(c.promedioDiario)} por día`,
      destacada: true,
    },
  ]

  const pautaCeldas: Placa[] = [
    {
      label: "Presupuesto que se debía haber gastado",
      ...pesos(c.presupuestoEsperado),
      hint:
        c.presupuestoEsperado === null
          ? sinPresupuesto
          : invertido === null
            ? "Presupuesto ÷ días del mes × días corridos"
            : invertido >= c.presupuestoEsperado
              ? `Van ${formatCOPShort(invertido - c.presupuestoEsperado)} por encima`
              : `Van ${formatCOPShort(c.presupuestoEsperado - invertido)} por debajo`,
    },
    {
      label: "Falta por invertir",
      ...pesos(c.faltaPorInvertir),
      hint:
        c.faltaPorInvertir === null
          ? sinPresupuesto
          : c.faltaPorInvertir < 0
            ? "Se pasó del presupuesto"
            : "Presupuesto − invertido",
    },
    {
      label: "Proyección faltante",
      ...pesos(c.proyeccionFaltante),
      hint:
        c.faltaPorInvertir === null
          ? sinPresupuesto
          : c.roas === null
            ? "Falta lo invertido para tener ROAS"
            : "ROAS × lo que falta por invertir",
      destacada: true,
    },
    {
      label: "Proyección total",
      ...pesos(c.proyeccionTotal),
      hint:
        c.proyeccionTotal === null
          ? "Proyección faltante + facturación"
          : meta === null
            ? "Proyección faltante + facturación"
            : c.proyeccionTotal >= meta
              ? "Alcanza la meta"
              : `Quedaría ${formatCOPShort(meta - c.proyeccionTotal)} bajo la meta`,
      destacada: true,
    },
  ]

  return (
    <div className="space-y-4">
      <Placas celdas={facturacionCeldas} className="lg:grid-cols-4 print:grid-cols-4" />
      <Placas celdas={pautaCeldas} className="lg:grid-cols-4 print:grid-cols-4" />
    </div>
  )
}
