import "server-only"

import { businessDaysInMonth } from "@/lib/kpi"
import { diasHabilesEnRango, finDeMes, mesesDe, type FilaIndicadores } from "@/lib/indicadores"
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
}

export async function loadIndicadores(
  companyId: string,
  desde: string,
  hasta: string,
): Promise<DatosIndicadores> {
  const supabase = await createClient()
  const meses = mesesDe(desde, hasta)

  const [filas, config] = await Promise.all([
    supabase.rpc("indicadores_por_comercial", {
      p_company: companyId,
      p_desde: desde,
      p_hasta: hasta,
    }),
    supabase
      .from("company_business_days")
      .select("period_month, dias")
      .eq("company_id", companyId)
      .in("period_month", meses),
  ])

  if (filas.error) throw new Error(`indicadores: ${filas.error.message}`)

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
  }
}
