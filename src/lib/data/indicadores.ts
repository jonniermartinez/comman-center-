import "server-only"

import { businessDaysInMonth } from "@/lib/kpi"
import {
  diasHabilesEnRango,
  esCodigoKpi,
  finDeMes,
  mesesDe,
  type FilaIndicadores,
  type MetasEmpresa,
} from "@/lib/indicadores"
import { createClient } from "@/lib/supabase/server"

export interface DatosIndicadores {
  /** Una fila por comercial con actividad o ventas en el rango. */
  filas: FilaIndicadores[]
  /**
   * Días hábiles del período por comercial. Si el rango cubre meses enteros
   * se usa lo que la empresa configuró para cada mes (o lunes a sábado si no
   * configuró nada); si es un pedazo de mes, se cuentan lunes a sábado del
   * rango.
   */
  diasHabiles: number
  /** Los días hábiles configurados por mes, para el campo editable. */
  configurados: { period_month: string; dias: number }[]
  /** Las metas que la empresa fijó por su cuenta. Lo que falte usa la de por defecto. */
  metas: MetasEmpresa
  /**
   * Lo digitado de pauta por mes, para los campos editables: el presupuesto
   * autorizado y lo que va invertido. Cualquiera de los dos puede faltar.
   */
  inversionPorMes: { period_month: string; monto: number | null; presupuesto: number | null }[]
  /**
   * La inversión del período, o null si ningún mes del rango tiene dato. Se
   * suma por meses enteros: la pauta se anota como acumulado del mes y no se
   * puede repartir por días, así que un rango de medio mes toma el mes completo.
   */
  inversion: number | null
  /** El presupuesto autorizado del período, sumado igual que la inversión. */
  presupuesto: number | null
  /**
   * La meta de facturación de la empresa por mes, la que se fija en Objetivos.
   * Contra ella se calcula el promedio diario que hace falta para llegar.
   */
  metaFacturacionPorMes: { period_month: string; meta: number }[]
}

export async function loadIndicadores(
  companyId: string,
  desde: string,
  hasta: string,
): Promise<DatosIndicadores> {
  const supabase = await createClient()
  const meses = mesesDe(desde, hasta)

  const [filas, config, metasFijadas, pauta, objetivos] = await Promise.all([
    supabase.rpc("indicadores_por_comercial", {
      p_company: companyId,
      p_desde: desde,
      p_hasta: hasta,
    }),
    supabase
      .from("company_business_days")
      .select("period_month, dias")
      .eq("company_id", companyId)
      // Una fila puede traer solo los transcurridos (060): sin `dias` no fija nada.
      .not("dias", "is", null)
      .in("period_month", meses),
    supabase.from("company_kpi_targets").select("kpi_code, meta").eq("company_id", companyId),
    supabase
      .from("company_ad_spend")
      .select("period_month, monto, presupuesto")
      .eq("company_id", companyId)
      .in("period_month", meses),
    supabase
      .from("objectives")
      .select("period_month, target_value")
      .eq("company_id", companyId)
      .eq("metric_code", "facturacion")
      .is("user_id", null)
      .in("period_month", meses),
  ])

  if (filas.error) throw new Error(`indicadores: ${filas.error.message}`)

  // Un código que el tablero ya no conozca se ignora: la fila queda en la base
  // sin hacer daño hasta que alguien la borre.
  const metas: MetasEmpresa = {}
  for (const m of metasFijadas.data ?? []) {
    if (esCodigoKpi(m.kpi_code) && Number(m.meta) > 0) metas[m.kpi_code] = Number(m.meta)
  }

  const configurados = (config.data ?? []).map((c) => ({
    period_month: c.period_month,
    dias: Number(c.dias),
  }))

  let diasHabiles = 0
  for (const mes of meses) {
    const cubreEntero = desde <= mes && hasta >= finDeMes(mes)
    const fijado = configurados.find((c) => c.period_month === mes)?.dias
    if (cubreEntero) {
      diasHabiles += fijado ?? businessDaysInMonth(mes)
    } else {
      const a = desde > mes ? desde : mes
      const b = hasta < finDeMes(mes) ? hasta : finDeMes(mes)
      diasHabiles += diasHabilesEnRango(a, b)
    }
  }

  const inversionPorMes = (pauta.data ?? []).map((p) => ({
    period_month: p.period_month,
    monto: p.monto === null ? null : Number(p.monto),
    presupuesto: p.presupuesto === null ? null : Number(p.presupuesto),
  }))
  const sumar = (campo: "monto" | "presupuesto") => {
    const anotados = inversionPorMes.flatMap((p) => (p[campo] === null ? [] : [p[campo]]))
    return anotados.length ? anotados.reduce((suma, n) => suma + n, 0) : null
  }
  const metaFacturacionPorMes = (objetivos.data ?? [])
    .map((o) => ({ period_month: o.period_month, meta: Number(o.target_value) }))
    .filter((o) => o.meta > 0)

  const numero = (v: unknown) => Number(v ?? 0)
  return {
    filas: (filas.data ?? []).map((f) => {
      const fila = Object.fromEntries(
        Object.entries(f).map(([k, v]) =>
          k === "staff_id" || k === "responsable_nombre" ? [k, v] : [k, numero(v)],
        ),
      ) as unknown as FilaIndicadores
      fila.responsable_nombre = (f.responsable_nombre as string) || "Sin responsable"
      return fila
    }),
    diasHabiles,
    configurados,
    metas,
    inversionPorMes,
    inversion: sumar("monto"),
    presupuesto: sumar("presupuesto"),
    metaFacturacionPorMes,
  }
}
