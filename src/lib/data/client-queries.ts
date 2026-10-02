"use client"

import { useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"

export interface BranchMonthly {
  branch_id: string
  branch_name: string
  comerciales: number
  ventas_mes: number
  licencias_mes: number
  facturacion_mes: number
  recaudo_mes: number
  ratio_contactabilidad: number | null
}

/**
 * Totales del mes por sede, tal como los calcula Postgres.
 *
 * Se consulta la vista desde el navegador en vez de traer las ventas y sumarlas
 * acá: son decenas de miles de filas y el mismo cálculo ya está escrito en SQL.
 * Como es una vista con `security_invoker`, devuelve solo lo que esta sesión
 * puede ver.
 */
export function useBranchMonthly(companyId: string, month: string) {
  const [datos, setDatos] = useState<BranchMonthly[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    supabase
      .from("v_branch_monthly")
      .select("branch_id, branch_name, comerciales, ventas_mes, licencias_mes, facturacion_mes, recaudo_mes, ratio_contactabilidad")
      .eq("company_id", companyId)
      .eq("period_month", month)
      .then(({ data }) => {
        if (!vigente) return
        setDatos((data ?? []) as unknown as BranchMonthly[])
        setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [companyId, month])

  return { datos, cargando }
}

export interface CompanyMonthly {
  company_id: string
  company_name: string
  ventas_mes: number
  licencias_mes: number
  renovaciones_mes: number
  facturacion_mes: number
  recaudo_mes: number
  /** Lo invertido en pauta ese mes, o null si nadie lo anotó. De ahí salen el ROAS y el costo por venta. */
  inversion_pauta: number | null
}

/** Totales del mes de todas las empresas visibles. Alimenta el grid de inicio. */
export function useCompanyMonthly(month: string) {
  const [datos, setDatos] = useState<CompanyMonthly[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()
    Promise.all([
      supabase
        .from("v_monthly_totals")
        .select("company_id, company_name, ventas_mes, licencias_mes, renovaciones_mes, facturacion_mes, recaudo_mes")
        .eq("period_month", month),
      supabase.from("company_ad_spend").select("company_id, monto").eq("period_month", month),
    ]).then(([totales, pauta]) => {
      if (!vigente) return
      const invertido = new Map(
        (pauta.data ?? []).filter((p) => p.monto !== null).map((p) => [p.company_id, Number(p.monto)]),
      )
      setDatos(
        ((totales.data ?? []) as unknown as Omit<CompanyMonthly, "inversion_pauta">[]).map((t) => ({
          ...t,
          inversion_pauta: invertido.get(t.company_id) ?? null,
        })),
      )
      setCargando(false)
    })
    return () => {
      vigente = false
    }
  }, [month])

  return { datos, cargando }
}

export interface ObjectiveProgressRow {
  company_id: string
  period_month: string
  metric_code: string
  metric_name: string
  unit: "cantidad" | "moneda" | "porcentaje"
  user_id: string | null
  target_value: number
  real_value: number
  cumplimiento: number | null
}

/**
 * Cumplimiento de las metas del mes.
 *
 * Meta y real vienen juntos de la vista: calcular el real acá obligaría a
 * repetir en TypeScript las mismas sumas que ya hace `v_objective_progress`, y
 * es cuestión de tiempo que las dos versiones dejen de coincidir.
 */
export function useObjectiveProgress(companyId: string, month: string) {
  const [datos, setDatos] = useState<ObjectiveProgressRow[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    createClient()
      .from("v_objective_progress")
      .select("*")
      .eq("company_id", companyId)
      .eq("period_month", month)
      .then(({ data }) => {
        if (!vigente) return
        setDatos((data ?? []) as unknown as ObjectiveProgressRow[])
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [companyId, month])

  return { datos, cargando }
}
