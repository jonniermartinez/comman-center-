/**
 * Cálculos que la interfaz necesita hacer por su cuenta.
 *
 * Los agregados de negocio —totales del mes, ratios, cumplimiento— **no** están
 * acá: los calcula Postgres en las vistas de `supabase/migrations/014`. Tenerlos
 * en dos sitios es la forma más segura de que un día no coincidan.
 *
 * Lo que queda es lo que depende del calendario o del formato, que la base no
 * tiene por qué saber.
 */

/** División segura: null cuando el denominador es 0 (se muestra "—", no 0%). */
export function safeRatio(numerador: number, denominador: number): number | null {
  if (!denominador) return null
  return numerador / denominador
}

export function monthOf(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function isSameMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month.slice(0, 7)
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return `${MESES[m - 1]} ${y}`
}

/** Días hábiles (lunes a sábado, como opera el negocio) en un mes. */
export function businessDaysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number)
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate()
  let cuenta = 0
  for (let d = 1; d <= dias; d++) {
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) cuenta++
  }
  return cuenta
}

export function businessDaysElapsed(month: string, today: string): number {
  if (!isSameMonth(today, month)) return businessDaysInMonth(month)
  const [y, m] = month.split("-").map(Number)
  const ultimo = Number(today.slice(8, 10))
  let cuenta = 0
  for (let d = 1; d <= ultimo; d++) {
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) cuenta++
  }
  return cuenta
}

/** Proyección a fin de mes según los días hábiles transcurridos. */
export function proyectar(real: number, month: string, today: string): number {
  const transcurridos = businessDaysElapsed(month, today)
  if (!transcurridos) return real
  return (real / transcurridos) * businessDaysInMonth(month)
}
