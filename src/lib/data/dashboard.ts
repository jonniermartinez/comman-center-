import "server-only"

import { createClient } from "@/lib/supabase/server"

export interface DashboardData {
  totales: {
    ventas: number
    licencias: number
    renovaciones: number
    facturacion: number
    recaudo: number
  }
  porFinanciacion: {
    financing_code: string | null
    financing_name: string | null
    ventas: number
    licencias: number
    facturacion: number
  }[]
  porMedioPago: { method_code: string | null; nombre: string; pagos: number; amount: number }[]
  porSede: {
    branch_id: string
    branch_name: string
    comerciales: number
    ventas_mes: number
    facturacion_mes: number
    recaudo_mes: number
    ratio_contactabilidad: number | null
  }[]
  ranking: {
    staff_id: string
    responsable_nombre: string
    dias_reportados: number
    dias_tarde: number
    total_llamadas: number
    llamadas_contestadas: number
    llamada_efectiva: number
    total_atencion: number
    ratio_contactabilidad: number | null
    ratio_conversion_llamada: number | null
  }[]
  capturaHoy: { staff_id: string; responsable_nombre: string; registrado: boolean }[]
  /** Serie diaria del mes, para la gráfica de evolución. */
  serieDiaria: { dia: number; ventas: number; facturacion: number; recaudo: number }[]
  /** De las llamadas a la venta: dónde se cae la gestión. */
  embudo: { nombre: string; valor: number }[]
}

/**
 * Todo lo que pinta el dashboard, leído de las vistas.
 *
 * Ninguna de estas cifras se calcula acá: si se sumaran las ventas en
 * TypeScript, el dashboard y los reportes podrían dar números distintos para lo
 * mismo, que es exactamente lo que el Excel hacía mal.
 */
export async function loadDashboard(companyId: string, mes: string): Promise<DashboardData> {
  const supabase = await createClient()

  const finDeMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10)

  const [totales, financiacion, medios, sedes, ranking, captura, ventasDia, pagosDia, nombresMedio] =
    await Promise.all([
    supabase
      .from("v_monthly_totals")
      .select("ventas_mes, licencias_mes, renovaciones_mes, facturacion_mes, recaudo_mes")
      .eq("company_id", companyId)
      .eq("period_month", mes)
      .maybeSingle(),
    supabase
      .from("v_monthly_sales_by_financing")
      .select("financing_code, financing_name, ventas, licencias, facturacion")
      .eq("company_id", companyId)
      .eq("period_month", mes),
    supabase
      .from("v_monthly_collection")
      .select("method_code, pagos, amount")
      .eq("company_id", companyId)
      .eq("period_month", mes),
    supabase
      .from("v_branch_monthly")
      .select("branch_id, branch_name, comerciales, ventas_mes, facturacion_mes, recaudo_mes, ratio_contactabilidad")
      .eq("company_id", companyId)
      .eq("period_month", mes),
    supabase
      .from("v_monthly_activity")
      .select("staff_id, responsable_nombre, dias_reportados, dias_tarde, total_llamadas, llamadas_contestadas, llamada_efectiva, llamada_agenda, total_agendas, total_atencion, atencion_venta, ratio_contactabilidad, ratio_conversion_llamada")
      .eq("company_id", companyId)
      .eq("period_month", mes),
    supabase
      .from("v_capture_status")
      .select("staff_id, responsable_nombre, registrado")
      .eq("company_id", companyId),
    supabase
      .from("v_daily_sales")
      .select("report_date, ventas, facturacion")
      .eq("company_id", companyId)
      .gte("report_date", mes)
      .lte("report_date", finDeMes),
    supabase
      .from("payments")
      .select("report_date, amount")
      .eq("company_id", companyId)
      .gte("report_date", mes)
      .lte("report_date", finDeMes)
      .limit(20000),
    supabase.from("payment_methods").select("code, name"),
  ])

  const numero = (v: unknown) => Number(v ?? 0)

  // La vista devuelve una fila por sede; el mismo comercial puede aparecer en
  // varias, así que se suman antes de ordenar el ranking.
  const porPersona = new Map<string, DashboardData["ranking"][number]>()
  for (const r of ranking.data ?? []) {
    const id = r.staff_id as string
    const previo = porPersona.get(id)
    const fila = {
      staff_id: id,
      responsable_nombre: (r.responsable_nombre as string) ?? "—",
      dias_reportados: numero(previo?.dias_reportados) + numero(r.dias_reportados),
      dias_tarde: numero(previo?.dias_tarde) + numero(r.dias_tarde),
      total_llamadas: numero(previo?.total_llamadas) + numero(r.total_llamadas),
      llamadas_contestadas: numero(previo?.llamadas_contestadas) + numero(r.llamadas_contestadas),
      llamada_efectiva: numero(previo?.llamada_efectiva) + numero(r.llamada_efectiva),
      total_atencion: numero(previo?.total_atencion) + numero(r.total_atencion),
      ratio_contactabilidad: null as number | null,
      ratio_conversion_llamada: null as number | null,
    }
    // Los ratios se rehacen sobre los totales sumados: promediar ratios da un
    // número falso.
    fila.ratio_contactabilidad = fila.total_llamadas
      ? fila.llamadas_contestadas / fila.total_llamadas
      : null
    fila.ratio_conversion_llamada = fila.total_llamadas
      ? fila.llamada_efectiva / fila.total_llamadas
      : null
    porPersona.set(id, fila)
  }

  // Serie diaria: las ventas y el recaudo del mes, día por día. Se arma acá
  // porque son dos fuentes —ventas y pagos— y ninguna vista las cruza.
  const porDia = new Map<number, { dia: number; ventas: number; facturacion: number; recaudo: number }>()
  const dia = (fecha: string) => Number(fecha.slice(8, 10))
  const tomar = (fecha: string) => {
    const d = dia(fecha)
    if (!porDia.has(d)) porDia.set(d, { dia: d, ventas: 0, facturacion: 0, recaudo: 0 })
    return porDia.get(d)!
  }
  for (const v of ventasDia.data ?? []) {
    const p = tomar(v.report_date as string)
    p.ventas += numero(v.ventas)
    p.facturacion += numero(v.facturacion)
  }
  for (const p of pagosDia.data ?? []) {
    tomar(p.report_date as string).recaudo += numero(p.amount)
  }
  const serie = [...porDia.values()].sort((a, b) => a.dia - b.dia)

  const totalesActividad = (ranking.data ?? []).reduce(
    (acc, r) => ({
      llamadas: acc.llamadas + numero(r.total_llamadas),
      contestadas: acc.contestadas + numero(r.llamadas_contestadas),
      agendas: acc.agendas + numero(r.total_agendas),
      atenciones: acc.atenciones + numero(r.total_atencion),
      ventas: acc.ventas + numero(r.llamada_efectiva) + numero(r.atencion_venta),
    }),
    { llamadas: 0, contestadas: 0, agendas: 0, atenciones: 0, ventas: 0 },
  )

  return {
    totales: {
      ventas: numero(totales.data?.ventas_mes),
      licencias: numero(totales.data?.licencias_mes),
      renovaciones: numero(totales.data?.renovaciones_mes),
      facturacion: numero(totales.data?.facturacion_mes),
      recaudo: numero(totales.data?.recaudo_mes),
    },
    porFinanciacion: (financiacion.data ?? [])
      .map((f) => ({
        financing_code: f.financing_code as string | null,
        financing_name: f.financing_name as string | null,
        ventas: numero(f.ventas),
        licencias: numero(f.licencias),
        facturacion: numero(f.facturacion),
      }))
      .sort((a, b) => b.facturacion - a.facturacion),
    porMedioPago: (medios.data ?? [])
      .map((m) => ({
        method_code: m.method_code as string | null,
        // El código es para la base; en pantalla va el nombre del catálogo, que
        // es como lo llama el equipo ("Brilla TTC", no "brilla_ttc").
        nombre:
          nombresMedio.data?.find((n) => n.code === m.method_code)?.name ??
          (m.method_code as string | null) ??
          "Sin medio",
        pagos: numero(m.pagos),
        amount: numero(m.amount),
      }))
      .sort((a, b) => b.amount - a.amount),
    porSede: (sedes.data ?? [])
      .map((s) => ({
        branch_id: s.branch_id as string,
        branch_name: (s.branch_name as string) ?? "—",
        comerciales: numero(s.comerciales),
        ventas_mes: numero(s.ventas_mes),
        facturacion_mes: numero(s.facturacion_mes),
        recaudo_mes: numero(s.recaudo_mes),
        ratio_contactabilidad:
          s.ratio_contactabilidad === null ? null : Number(s.ratio_contactabilidad),
      }))
      .sort((a, b) => b.facturacion_mes - a.facturacion_mes),
    ranking: [...porPersona.values()].sort((a, b) => b.llamada_efectiva - a.llamada_efectiva),
    capturaHoy: (captura.data ?? []).map((c) => ({
      staff_id: c.staff_id as string,
      responsable_nombre: (c.responsable_nombre as string) ?? "—",
      registrado: Boolean(c.registrado),
    })),
    serieDiaria: serie,
    embudo: [
      { nombre: "Llamadas", valor: totalesActividad.llamadas },
      { nombre: "Contestadas", valor: totalesActividad.contestadas },
      { nombre: "Agendas", valor: totalesActividad.agendas },
      { nombre: "Atenciones", valor: totalesActividad.atenciones },
      { nombre: "Ventas", valor: totalesActividad.ventas },
    ],
  }
}
