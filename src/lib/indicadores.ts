/**
 * Los indicadores del tablero: qué se mide, contra qué meta y cómo se lee.
 *
 * Las sumas las hace Postgres (`indicadores_por_comercial`, migración 044).
 * Acá solo se arman los ratios sobre esas sumas y se comparan con la meta.
 * Un ratio se calcula sobre los totales del filtro, nunca promediando los
 * ratios de cada comercial: promediar ratios da un número falso.
 *
 * Las metas son las que fijó la gerencia en septiembre de 2026. Son una regla
 * del negocio, no un dato de cada empresa, así que viven acá y no en la base.
 */

import { safeRatio } from "@/lib/kpi"

/** Una fila de `indicadores_por_comercial`, ya con los números convertidos. */
export interface FilaIndicadores {
  staff_id: string | null
  responsable_nombre: string
  dias_laborados: number
  dias_tarde: number
  llamada_no_contestada: number
  llamada_efectiva: number
  llamada_seguimiento: number
  llamada_agenda: number
  llamada_no_interesado: number
  llamada_postventa: number
  llamadas_contestadas: number
  total_llamadas: number
  agenda_confirmada: number
  agenda_posible: number
  agenda_reprograma: number
  agenda_no_contesta: number
  agenda_cancela: number
  total_agendas: number
  atencion_venta: number
  atencion_venta_externa: number
  atencion_seguimiento: number
  atencion_declinado: number
  total_atencion: number
  atencion_agenda: number
  atencion_asociado: number
  atencion_enrolamiento: number
  atencion_certificados: number
  atencion_renovacion: number
  total_administrativa: number
  chats_inicial: number
  chats_medio: number
  chats_final: number
  tareas_inicial: number
  tareas_medio: number
  tareas_final: number
  caducadas_inicial: number
  caducadas_medio: number
  caducadas_final: number
  ventas_total: number
  ventas_presencial: number
  ventas_digital: number
  ventas_sin_tipo: number
  valor_final: number
  adicion: number
  descuento: number
}

const CAMPOS_SUMABLES = [
  "dias_laborados", "dias_tarde",
  "llamada_no_contestada", "llamada_efectiva", "llamada_seguimiento", "llamada_agenda",
  "llamada_no_interesado", "llamada_postventa", "llamadas_contestadas", "total_llamadas",
  "agenda_confirmada", "agenda_posible", "agenda_reprograma", "agenda_no_contesta",
  "agenda_cancela", "total_agendas",
  "atencion_venta", "atencion_venta_externa", "atencion_seguimiento", "atencion_declinado",
  "total_atencion", "atencion_agenda", "atencion_asociado", "atencion_enrolamiento",
  "atencion_certificados", "atencion_renovacion", "total_administrativa",
  "chats_inicial", "chats_medio", "chats_final", "tareas_inicial", "tareas_medio",
  "tareas_final", "caducadas_inicial", "caducadas_medio", "caducadas_final",
  "ventas_total", "ventas_presencial", "ventas_digital", "ventas_sin_tipo",
  "valor_final", "adicion", "descuento",
] as const

export type CampoSumable = (typeof CAMPOS_SUMABLES)[number]

/** El consolidado de varias filas: la suma campo a campo. */
export function consolidar(filas: FilaIndicadores[]): FilaIndicadores {
  const total = Object.fromEntries(CAMPOS_SUMABLES.map((c) => [c, 0])) as Record<
    CampoSumable,
    number
  >
  for (const f of filas) for (const c of CAMPOS_SUMABLES) total[c] += Number(f[c] ?? 0)
  return { staff_id: null, responsable_nombre: "Total", ...total }
}

/** Metas fijadas por la gerencia. Ratios en fracción; cantidades por jornada. */
export const METAS = {
  contactabilidad: 0.7,
  conversion_agenda: 0.6,
  confirmacion_agenda: 0.4,
  venta_presencial: 0.7,
  volumen_agendas: 0.25,
  seguimiento: 0.55,
  agenda_a_venta: 0.3,
  contestadas_por_jornada: 45,
  agendas_atendidas_por_jornada: 6,
  dias_laborados: 0.8,
} as const

/**
 * Techo de los indicadores de banda: pasado este ratio el indicador va en rojo
 * aunque haya superado la meta. La gerencia fijó 85 % para venta presencial y
 * pidió el mismo criterio en seguimiento; queda con nombre porque es un número
 * que van a querer mover sin ir a buscarlo entre los cálculos.
 */
export const TOPES = {
  venta_presencial: 0.85,
  seguimiento: 0.85,
} as const

/**
 * Cómo se lee la meta de cada indicador. No todos se leen igual: en unos hay
 * que empujar sin techo, en otros pasarse del 100 % delata una captura mala, y
 * en otros la meta es un punto óptimo del que también se puede uno pasar.
 */
export type Semaforo =
  /** Más es mejor y no hay techo: verde al llegar o pasar la meta. */
  | "superar"
  /** Bueno superar la meta, pero un ratio sobre el 100 % es un error de captura. */
  | "con_techo"
  /** Hay un óptimo: quedarse corto está mal y pasarse del tope también. */
  | "banda"

export interface Kpi {
  code: string
  nombre: string
  /** Cómo se calcula, en palabras. */
  formula: string
  unit: "porcentaje" | "cantidad"
  numerador: number
  denominador: number
  logrado: number | null
  meta: number
  semaforo: Semaforo
  /** Ratio a partir del cual la banda se pone en rojo. Solo en `banda`. */
  tope: number | null
  /**
   * El dato es imposible y va en rojo pase lo que pase.
   *
   * Existe por los indicadores de cantidad con techo. En un ratio el techo es
   * el 100 % y se ve en la propia cifra —no se puede agendar más veces de las
   * que se contestó el teléfono—, pero "seis agendas al día" no tiene 100 %
   * que mirar. Ahí la imposibilidad se comprueba contra otro campo y llega
   * resuelta.
   */
  alarma: boolean
  /** Logrado ÷ meta. Es el "porcentaje de cumplimiento" que piden en todos los KPI. */
  efectividad: number | null
}

/**
 * Lo que hace falta para construir un KPI. El tope va atado a `banda` en el
 * tipo para que no se pueda declarar una banda sin decir dónde termina.
 */
type ConfigKpi = {
  code: string
  nombre: string
  formula: string
  unit: Kpi["unit"]
  numerador: number
  denominador: number
  meta: number
  /** Solo para `con_techo` sobre cantidades: ver `Kpi.alarma`. */
  alarma?: boolean
} & ({ semaforo: "superar" | "con_techo" } | { semaforo: "banda"; tope: number })

function kpi(cfg: ConfigKpi): Kpi {
  const logrado = safeRatio(cfg.numerador, cfg.denominador)
  return {
    code: cfg.code,
    nombre: cfg.nombre,
    formula: cfg.formula,
    unit: cfg.unit,
    numerador: cfg.numerador,
    denominador: cfg.denominador,
    logrado,
    meta: cfg.meta,
    semaforo: cfg.semaforo,
    tope: "tope" in cfg ? cfg.tope : null,
    alarma: cfg.alarma ?? false,
    efectividad: logrado === null ? null : logrado / cfg.meta,
  }
}

export type Tono = "verde" | "ambar" | "rojo" | "neutro"

/** Cómo se pinta un KPI: el color y qué tan llena va la barra. */
export interface LecturaKpi {
  tono: Tono
  /** Qué tan llena va la barra, de 0 a 100. */
  avance: number
  /** Dónde cae la meta dentro de la barra, en % de su ancho. 100 = al final. */
  marcaMeta: number
}

/** Efectividad desde la que el indicador está "cerca" y va ámbar, no rojo. */
const CERCA = 0.8

/**
 * Un ratio calculado rara vez cae exacto en la meta: 0,7 sale como
 * 0,7000000000000001 y la división lo deja en 1,0000000000000002. Sin holgura,
 * cumplir la meta justa se leería como haberse pasado.
 */
const HOLGURA = 1e-9

/**
 * El semáforo de un KPI, resuelto acá y no en la tarjeta: es una regla del
 * negocio, y el componente solo tiene que pedirla y pintarla.
 *
 * La barra no siempre mide contra la meta. Cuando pasarse importa —`banda` y
 * `con_techo`— se mide contra el techo, porque llenar la barra al superar la
 * meta hacía que pasarse y cumplir justo se vieran idénticos, que es justo lo
 * que la gerencia quiere distinguir.
 */
export function leerKpi(k: Kpi): LecturaKpi {
  const e = k.efectividad
  if (k.logrado === null || e === null) return { tono: "neutro", avance: 0, marcaMeta: 100 }

  const escalar = (valor: number, escala: number) =>
    Math.min(100, Math.max(0, (valor / escala) * 100))
  // Debajo de la meta los tres se leen igual: qué tan lejos quedó.
  const corto: Tono = e >= CERCA ? "ambar" : "rojo"

  if (k.semaforo === "banda" && k.tope !== null) {
    const tono: Tono =
      k.logrado > k.tope ? "rojo" : e > 1 + HOLGURA ? "ambar" : e >= 1 - HOLGURA ? "verde" : corto
    return {
      tono,
      avance: escalar(k.logrado, k.tope),
      marcaMeta: escalar(k.meta, k.tope),
    }
  }

  if (k.semaforo === "con_techo") {
    // Un ratio por encima del 100 % no existe en estos indicadores: si aparece,
    // alguien sumó mal la hoja de gestión y el rojo es la alarma de captura.
    // En los de cantidad ese 100 % no está en la cifra, y la imposibilidad
    // viene ya comprobada en `alarma`.
    const imposible = k.unit === "porcentaje" ? k.logrado > 1 + HOLGURA : k.alarma
    const tono: Tono = imposible ? "rojo" : e >= 1 - HOLGURA ? "verde" : corto
    return k.unit === "porcentaje"
      ? { tono, avance: escalar(k.logrado, 1), marcaMeta: escalar(k.meta, 1) }
      : { tono, avance: escalar(e, 1), marcaMeta: 100 }
  }

  return {
    tono: e >= 1 - HOLGURA ? "verde" : corto,
    avance: escalar(e, 1),
    marcaMeta: 100,
  }
}

/**
 * Los KPI con meta, sobre un consolidado.
 *
 * `diasHabiles` es cuántos días hábiles caben en el período por comercial;
 * `comerciales` cuántas personas están sumadas, para que el absentismo del
 * consolidado se mida contra hábiles × personas.
 */
export function kpisDe(t: FilaIndicadores, diasHabiles: number, comerciales: number): Kpi[] {
  const ventasGestion = t.llamada_efectiva + t.atencion_venta + t.atencion_venta_externa
  return [
    kpi({
      code: "contactabilidad",
      nombre: "Contactabilidad",
      formula: "Llamadas contestadas ÷ total de llamadas",
      unit: "porcentaje",
      numerador: t.llamadas_contestadas,
      denominador: t.total_llamadas,
      meta: METAS.contactabilidad,
      semaforo: "superar",
    }),
    kpi({
      code: "conversion_agenda",
      nombre: "Conversión de agenda",
      formula: "Total de agendas ÷ llamadas contestadas",
      unit: "porcentaje",
      numerador: t.total_agendas,
      denominador: t.llamadas_contestadas,
      meta: METAS.conversion_agenda,
      semaforo: "con_techo",
    }),
    kpi({
      code: "confirmacion_agenda",
      nombre: "Confirmación de agenda",
      formula: "Agendas confirmadas ÷ total de agendas",
      unit: "porcentaje",
      numerador: t.agenda_confirmada,
      denominador: t.total_agendas,
      meta: METAS.confirmacion_agenda,
      semaforo: "con_techo",
    }),
    kpi({
      code: "venta_presencial",
      nombre: "Venta presencial",
      formula: "Ventas presenciales ÷ total de atención presencial",
      unit: "porcentaje",
      numerador: t.atencion_venta + t.atencion_venta_externa,
      denominador: t.total_atencion,
      meta: METAS.venta_presencial,
      semaforo: "banda",
      tope: TOPES.venta_presencial,
    }),
    kpi({
      code: "volumen_agendas",
      nombre: "Volumen de agendas",
      formula: "Total de agendas ÷ total de llamadas",
      unit: "porcentaje",
      numerador: t.total_agendas,
      denominador: t.total_llamadas,
      meta: METAS.volumen_agendas,
      semaforo: "superar",
    }),
    kpi({
      code: "seguimiento",
      nombre: "Seguimiento",
      formula: "Llamadas de seguimiento ÷ total de llamadas",
      unit: "porcentaje",
      numerador: t.llamada_seguimiento,
      denominador: t.total_llamadas,
      meta: METAS.seguimiento,
      semaforo: "banda",
      tope: TOPES.seguimiento,
    }),
    kpi({
      code: "agenda_a_venta",
      nombre: "Conversión de agenda a venta",
      formula: "Ventas de la gestión (efectivas + presenciales) ÷ total de agendas",
      unit: "porcentaje",
      numerador: ventasGestion,
      denominador: t.total_agendas,
      meta: METAS.agenda_a_venta,
      semaforo: "con_techo",
    }),
    kpi({
      code: "contestadas_por_jornada",
      nombre: "Llamadas contestadas al día",
      formula: "Llamadas contestadas ÷ jornadas registradas · meta 45 por asesor",
      unit: "cantidad",
      numerador: t.llamadas_contestadas,
      denominador: t.dias_laborados,
      meta: METAS.contestadas_por_jornada,
      semaforo: "superar",
    }),
    kpi({
      code: "agendas_atendidas_por_jornada",
      nombre: "Agendas efectivas al día",
      formula: "Atención de agenda ÷ jornadas registradas · meta 6 por asesor",
      unit: "cantidad",
      numerador: t.atencion_agenda,
      denominador: t.dias_laborados,
      meta: METAS.agendas_atendidas_por_jornada,
      semaforo: "con_techo",
      // Atender más agendas de las que hubo es el dato imposible que hay que
      // cazar acá: superar las seis diarias está bien, atender ocho de seis no.
      alarma: t.atencion_agenda > t.total_agendas,
    }),
    kpi({
      code: "dias_laborados",
      nombre: "Días laborados",
      formula: "Jornadas registradas ÷ días hábiles del período",
      unit: "porcentaje",
      numerador: t.dias_laborados,
      denominador: diasHabiles * Math.max(comerciales, 1),
      meta: METAS.dias_laborados,
      semaforo: "superar",
    }),
  ]
}

/**
 * El reparto de ventas por canal: presencial y digital sobre el total.
 *
 * Va aparte de `kpisDe` a propósito. Son dos números que suman 100 % entre sí,
 * así que ponerle meta a cada uno se contradice: si el presencial "cumple" el
 * digital "incumple" por la misma venta. Se muestran como distribución, sin
 * semáforo. Las ventas sin tipo quedan fuera del reparto —no se sabe de qué
 * canal son— y se informan aparte para que el total cuadre.
 */
export function repartoPorCanal(t: FilaIndicadores) {
  const conTipo = t.ventas_presencial + t.ventas_digital
  return {
    conTipo,
    sinTipo: t.ventas_sin_tipo,
    presencial: { cantidad: t.ventas_presencial, ratio: safeRatio(t.ventas_presencial, conTipo) },
    digital: { cantidad: t.ventas_digital, ratio: safeRatio(t.ventas_digital, conTipo) },
  }
}

/** Promedios por jornada registrada (KPI 3). */
export function promediosDe(t: FilaIndicadores) {
  return {
    agendas: safeRatio(t.total_agendas, t.dias_laborados),
    contestadas: safeRatio(t.llamadas_contestadas, t.dias_laborados),
    atencion_presencial: safeRatio(t.total_atencion, t.dias_laborados),
  }
}

/**
 * Facturación total como la definió la gerencia: valor final − (adición +
 * descuento). Se muestra junto al valor final para que se vea la diferencia.
 */
export function facturacionTotal(t: FilaIndicadores): number {
  return t.valor_final - (t.adicion + t.descuento)
}

/** Días hábiles de lunes a sábado dentro de un rango, ambos inclusive. */
export function diasHabilesEnRango(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00Z`)
  const b = new Date(`${hasta}T00:00:00Z`)
  let cuenta = 0
  for (let d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) cuenta++
  }
  return cuenta
}

/** Los meses (`YYYY-MM-01`) que toca un rango. */
export function mesesDe(desde: string, hasta: string): string[] {
  const meses: string[] = []
  let cursor = `${desde.slice(0, 7)}-01`
  const fin = `${hasta.slice(0, 7)}-01`
  while (cursor <= fin) {
    meses.push(cursor)
    const [y, m] = cursor.split("-").map(Number)
    const d = new Date(Date.UTC(y, m, 1))
    cursor = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`
  }
  return meses
}

/** Último día de un mes `YYYY-MM-01`, como `YYYY-MM-DD`. */
export function finDeMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
