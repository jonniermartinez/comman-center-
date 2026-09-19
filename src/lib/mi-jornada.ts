/**
 * El vocabulario de una jornada en curso.
 *
 * Es el espejo de `jornada_columna()` en Postgres (051): la misma lista de
 * tipificaciones, en el mismo orden en que se ofrecen en pantalla. La base es
 * la que decide qué es válido —si algo no cae en un contador, lo rechaza—; esto
 * es solo cómo se llama y cómo se agrupa para que quepa en un pulgar.
 */

export type Categoria = "comercial" | "administrativa"

export interface Opcion {
  code: string
  label: string
  /** Clases de Tailwind del botón. El color es el del Excel, no decoración. */
  tono: string
}

/** El verde es venta, el rojo es que se cayó, el ámbar es que sigue vivo. */
const VENTA = "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
const CAIDO = "border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
const VIVO = "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
const AGENDA = "border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200"
const NEUTRO = "border-border bg-card hover:bg-muted"

/** Contestó y la llamada era de venta. Las cuatro de siempre. */
export const LLAMADA_COMERCIAL: Opcion[] = [
  { code: "venta", label: "Venta", tono: VENTA },
  { code: "no_interesado", label: "No interesado", tono: CAIDO },
  { code: "seguimiento", label: "Seguimiento", tono: VIVO },
  { code: "agenda", label: "Agendó cita", tono: AGENDA },
]

/**
 * Llamar a un cliente que ya tiene cita, para confirmar que viene.
 *
 * Va aparte de las cuatro de arriba porque no es lo mismo buscar un cliente
 * nuevo que confirmar uno que ya dijo que sí, y en el Excel cuentan en
 * columnas distintas.
 */
export const LLAMADA_AGENDA: Opcion[] = [
  { code: "confirma", label: "Confirma que viene", tono: VENTA },
  { code: "posible", label: "Posible asistencia", tono: VIVO },
  { code: "reprograma", label: "Reprograma", tono: AGENDA },
  { code: "no_contesta", label: "No contesta", tono: NEUTRO },
  { code: "cancela", label: "Cancela", tono: CAIDO },
]

/** Trámites, no venta: cuentan en el bloque administrativo del Excel. */
export const ADMINISTRATIVA: Opcion[] = [
  { code: "asociados", label: "Asociados", tono: NEUTRO },
  { code: "enrolamiento", label: "Enrolamiento", tono: NEUTRO },
  { code: "certificado", label: "Certificado", tono: NEUTRO },
  { code: "renovaciones", label: "Renovaciones", tono: NEUTRO },
]

/** El cliente vino al punto. */
export const PRESENCIAL_COMERCIAL: Opcion[] = [
  { code: "venta", label: "Venta", tono: VENTA },
  { code: "venta_externa", label: "Venta externa", tono: VENTA },
  { code: "seguimiento", label: "Seguimiento", tono: VIVO },
  { code: "no_interesado", label: "Declinó", tono: CAIDO },
  { code: "agenda", label: "Vino por su cita", tono: AGENDA },
]

export const PAUSAS = [
  { code: "bano", label: "Baño" },
  { code: "capacitacion", label: "Capacitación" },
  { code: "almuerzo", label: "Almuerzo" },
] as const

export type TipoPausa = (typeof PAUSAS)[number]["code"]

export const MOMENTOS = [
  { code: "inicial", label: "Inicial" },
  { code: "medio_dia", label: "Medio día" },
  { code: "final", label: "Final" },
] as const

export type Momento = (typeof MOMENTOS)[number]["code"]

const ETIQUETAS: Record<string, string> = Object.fromEntries(
  [...LLAMADA_COMERCIAL, ...LLAMADA_AGENDA, ...ADMINISTRATIVA, ...PRESENCIAL_COMERCIAL].map((o) => [
    o.code,
    o.label,
  ]),
)
for (const p of PAUSAS) ETIQUETAS[p.code] = p.label

export function etiqueta(code: string | null): string {
  if (!code) return "—"
  return ETIQUETAS[code] ?? code
}

/** 01:23:45. Monoespaciado en pantalla para que no baile cada segundo. */
export function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(s / 3600)).padStart(2, "0")
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  return `${h}:${m}:${String(s % 60).padStart(2, "0")}`
}

/** «45s», «3m 20s». Para duraciones cortas, donde las horas sobran. */
export function duracionCorta(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

/**
 * Hoy en Bogotá, no donde corra el servidor.
 *
 * La aplicación se despliega en Cloudflare, que corre en UTC: después de las
 * 7 p.m. de Colombia `new Date()` ya dice mañana, y una jornada que cambia de
 * día a media tarde no sirve. La base calcula sus fechas con `America/Bogota`
 * por lo mismo; esto es la misma cuenta del lado del navegador.
 */
export function hoyEnBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}
