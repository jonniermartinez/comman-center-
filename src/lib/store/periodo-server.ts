import { cookies } from "next/headers"

import { todayISO } from "@/lib/format"
import { monthOf } from "@/lib/kpi"
import { COOKIE_MES } from "@/lib/store/periodo-cookie"

/**
 * Mes que debe mostrar una pantalla de servidor.
 *
 * Manda la URL cuando trae `?mes=`, porque un enlace a un mes concreto tiene
 * que abrirse en ese mes. Si no, la cookie, que es lo que hace que la elección
 * sobreviva al cambiar de pantalla sin tener que colgarle el mes a cada enlace
 * de la aplicación. Y si tampoco, el mes en curso.
 */
export async function mesActivo(enUrl?: string | string[]): Promise<string> {
  if (typeof enUrl === "string" && /^\d{4}-\d{2}$/.test(enUrl)) return `${enUrl}-01`

  const guardado = (await cookies()).get(COOKIE_MES)?.value
  if (guardado && /^\d{4}-\d{2}$/.test(guardado)) return `${guardado}-01`

  return monthOf(todayISO())
}
