/**
 * El vocabulario de una agenda.
 *
 * Vive fuera de los componentes porque la misma pregunta se hace en los dos
 * lados: el servidor arma la cola y cuenta, y cada fila en el navegador se
 * pinta con lo mismo. Las reglas de negocio —el tope de tres seguimientos,
 * qué transición es válida— están en Postgres (051); acá solo está cómo se
 * llama y cómo se ve.
 */

/** Las cuatro colas del módulo. La del día es la que se abre por defecto. */
export const COLAS = ["hoy", "validar", "seguimiento", "historico"] as const
export type Cola = (typeof COLAS)[number]

export function leerCola(valor: string | string[] | undefined): Cola {
  return typeof valor === "string" && (COLAS as readonly string[]).includes(valor)
    ? (valor as Cola)
    : "hoy"
}

/** Qué prioridades de `v_agendas` entran en cada cola. */
export const PRIORIDADES: Record<Exclude<Cola, "historico">, number[]> = {
  hoy: [1, 2],
  validar: [3, 4],
  seguimiento: [5],
}

/** Hasta acá se insiste con quien no asistió. El tope lo impone la base. */
export const MAX_SEGUIMIENTOS = 3

export type EstadoAgenda =
  | "pendiente"
  | "vencida"
  | "confirmada"
  | "posible"
  | "reprogramada"
  | "cancelada"
  | "asistio"
  | "no_asistio"
  | "descartada"
  | "cerrada"

/**
 * Cómo se lee cada estado y de qué color se pinta.
 *
 * `tono` son clases de Tailwind, no un nombre de color: el mismo estado tiene
 * que verse igual en claro y en oscuro, y eso se consigue con los tokens del
 * tema, no con un hex.
 */
export const ESTADOS: Record<EstadoAgenda, { label: string; tono: string; ayuda: string }> = {
  pendiente: {
    label: "Por validar",
    tono: "bg-muted text-muted-foreground",
    ayuda: "Nadie ha llamado todavía a este cliente.",
  },
  vencida: {
    label: "Es hoy, sin validar",
    tono: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    ayuda: "La cita es hoy y nunca se confirmó. Si no se llama ahora, ya no se llama.",
  },
  confirmada: {
    label: "Confirmada",
    tono: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    ayuda: "El cliente dijo que viene.",
  },
  posible: {
    label: "Posible",
    tono: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    ayuda: "El cliente no se comprometió. Vale la pena insistir antes del día.",
  },
  reprogramada: {
    label: "Reprogramada",
    tono: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
    ayuda: "Pidió otra fecha. Falta moverla en Kommo para que la cita exista ese día.",
  },
  cancelada: {
    label: "Cancelada",
    tono: "bg-destructive/10 text-destructive",
    ayuda: "El cliente canceló.",
  },
  asistio: {
    label: "Asistió",
    tono: "bg-emerald-600 text-white",
    ayuda: "Vino a la cita.",
  },
  no_asistio: {
    label: "No asistió",
    tono: "bg-destructive/10 text-destructive",
    ayuda: "El día pasó y no vino. Quedan llamadas de seguimiento.",
  },
  descartada: {
    label: "Descartada",
    tono: "bg-muted text-muted-foreground",
    ayuda: "Se dejó de perseguir a este cliente.",
  },
  cerrada: {
    label: "Cerrada",
    tono: "bg-muted text-muted-foreground",
    ayuda: "El origen ya trajo el resultado. No hay nada que gestionar.",
  },
}

export function estadoDe(code: string): { label: string; tono: string; ayuda: string } {
  return (
    ESTADOS[code as EstadoAgenda] ?? {
      label: code,
      tono: "bg-muted text-muted-foreground",
      ayuda: "",
    }
  )
}

/** En qué terminó la visita de quien sí asistió. */
export const ASISTENCIAS = [
  { code: "venta", label: "Venta" },
  { code: "seguimiento", label: "Queda en seguimiento" },
  { code: "no_interesado", label: "No le interesó" },
] as const

/** Cómo quedó la llamada de validación. */
export const RESULTADOS_LLAMADA = [
  { code: "no_contesta", label: "No contestó" },
  { code: "confirma", label: "Confirma" },
  { code: "posible", label: "Posible asistencia" },
  { code: "reprograma", label: "Reprograma" },
  { code: "cancela", label: "Cancela" },
] as const

export type ResultadoLlamada = (typeof RESULTADOS_LLAMADA)[number]["code"]

/**
 * Hoy en Bogotá, no hoy donde corra el servidor.
 *
 * La aplicación se despliega en Cloudflare, que corre en UTC: después de las
 * 7 p.m. de Colombia `new Date()` ya dice mañana, y una cola "del día" que se
 * adelanta cinco horas es peor que no tenerla. La base calcula sus fechas con
 * `America/Bogota` por lo mismo; esto es la misma cuenta del lado del cliente.
 */
export function hoyEnBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** El texto por defecto del recordatorio, para la empresa que no escribió el suyo. */
export const RECORDATORIO_POR_DEFECTO =
  "Hola {cliente}, te escribimos de {empresa} para recordarte tu cita del {fecha} a las {hora}. ¿Nos confirmas que vienes?"

/**
 * El recordatorio con los datos de la cita puestos.
 *
 * Las marcas se reemplazan una sola vez y lo que quede sin dato se limpia: un
 * mensaje que llegue diciendo "a las {hora}" es peor que uno sin la hora.
 */
export function armarRecordatorio(
  plantilla: string | null,
  datos: { cliente?: string | null; fecha: string; hora?: string | null; empresa: string },
): string {
  const [y, m, d] = datos.fecha.split("-")
  return (plantilla?.trim() || RECORDATORIO_POR_DEFECTO)
    .replaceAll("{cliente}", datos.cliente?.trim() || "")
    .replaceAll("{empresa}", datos.empresa)
    .replaceAll("{fecha}", `${d}/${m}/${y}`)
    .replaceAll("{hora}", datos.hora?.slice(0, 5) ?? "")
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
}
