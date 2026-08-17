/** Formatos de presentación en español de Colombia. */

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 })

export function formatCOP(value: number): string {
  return money.format(value)
}

/** Versión compacta para tarjetas: $21,9 M */
export function formatCOPShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`
  }
  if (Math.abs(value) >= 1_000) {
    return `$${Math.round(value / 1_000).toLocaleString("es-CO")} K`
  }
  return money.format(value)
}

export function formatNumber(value: number): string {
  return number.format(value)
}

/** Un ratio 0–1 como porcentaje. null → "—" (no hay dato, distinto de 0%). */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—"
  return `${(ratio * 100).toLocaleString("es-CO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

export function formatByUnit(value: number, unit: "cantidad" | "moneda" | "porcentaje"): string {
  if (unit === "moneda") return formatCOP(value)
  if (unit === "porcentaje") return `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`
  return number.format(value)
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

/** 2026-08-15 → 15/08/2026 (como en el Excel). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${d} ${MESES[Number(m) - 1]}`
}

export function todayISO(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-")
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
