/**
 * Kommo: tipos y utilidades puras para leer las agendas.
 *
 * En Command Center una agenda es una tarea del calendario de Kommo (050). Las
 * llamadas a Kommo pasan por `kommo_get` en Postgres, que es quien tiene el
 * token.
 */

export interface ConfigKommo {
  modo?: "tarea"
  /** Tipo de tarea que cuenta como agenda. Sin valor, cualquier tarea. */
  tipo_tarea_id?: number | null
  /** id de usuario de Kommo → id de `staff`. */
  usuarios?: Record<string, string>
  /** Sede para las agendas cuyo responsable no tiene una. */
  branch_id?: string | null
}

export interface KommoUsuario {
  id: number
  name: string
}

export interface EstructuraKommo {
  cuenta: string
  tiposTarea: { id: number; name: string }[]
  usuarios: KommoUsuario[]
}

/** Lo que devuelve `GET /api/v4/tasks`, tal cual se le pasa a la base. */
export interface KommoTarea {
  id: number
  entity_id: number | null
  entity_type: string | null
  task_type_id: number
  responsible_user_id: number
  complete_till: number
  text: string
  is_completed: boolean
  result?: { text?: string } | null
}

/** Colombia no tiene horario de verano: UTC−5 todo el año. */
const OFFSET_BOGOTA = 5 * 3600

/** Fecha ISO (AAAA-MM-DD) de Colombia → Unix del comienzo de ese día. */
export function inicioDelDia(fecha: string): number {
  return Math.floor(Date.parse(`${fecha}T00:00:00Z`) / 1000) + OFFSET_BOGOTA
}

export function finDelDia(fecha: string): number {
  return inicioDelDia(fecha) + 86399
}

/** Minúsculas, sin tildes ni espacios de más: para emparejar nombres. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Propone a qué persona del equipo corresponde cada usuario de Kommo.
 *
 * Solo sugiere cuando el nombre coincide sin ambigüedad: dos "Daniela" en el
 * equipo no se adivinan, se eligen a mano.
 */
export function sugerirUsuarios(
  usuarios: KommoUsuario[],
  equipo: { id: string; full_name: string }[],
): Record<string, string> {
  const sugerencia: Record<string, string> = {}
  for (const u of usuarios) {
    const nombre = normalizarNombre(u.name)
    if (!nombre) continue
    const exactos = equipo.filter((s) => normalizarNombre(s.full_name) === nombre)
    const parecidos = exactos.length
      ? exactos
      : equipo.filter((s) => {
          const otro = normalizarNombre(s.full_name)
          return otro.includes(nombre) || nombre.includes(otro)
        })
    if (parecidos.length === 1) sugerencia[String(u.id)] = parecidos[0].id
  }
  return sugerencia
}

/** Arma el query string que acepta `kommo_get`: corchetes literales, valores codificados. */
export function queryKommo(params: [string, string | number][]): string {
  return params.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
}

/** Si Kommo puede llegar a esta dirección: https y no un computador local. */
export function esDireccionPublica(base: string): boolean {
  try {
    const url = new URL(base)
    const host = url.hostname
    return (
      url.protocol === "https:" &&
      host !== "localhost" &&
      !host.startsWith("127.") &&
      !host.startsWith("10.") &&
      !host.startsWith("192.168.") &&
      !host.endsWith(".local")
    )
  } catch {
    return false
  }
}
