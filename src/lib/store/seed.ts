import type {
  AmountEntry,
  Database,
  DailyKpi,
  DailyManagement,
  SalesEntry,
} from "./types"

/**
 * Datos iniciales. Reproducen los pantallazos del Excel del 15/08/2026 para que
 * los dashboards se puedan comparar contra el archivo original, y generan el
 * resto del mes con variación para que las gráficas tengan forma.
 */

export const SEED_VERSION = 4

const RUTA_SEGURA = "co-ruta-segura"
const LV_UNION = "co-lv-union"

// Sedes. Ruta Segura opera en dos municipios; LV Unión en uno.
const RS_BUGA = "br-rs-buga"
const RS_TULUA = "br-rs-tulua"
const LV_PRINCIPAL = "br-lv-principal"

const U_JONNIER = "us-jonnier"
const U_JUAN = "us-nunez-juan"
const U_DANIELA = "us-manzano-daniela"
const U_CARLOS = "us-carlos-rios"
const U_LUCIA = "us-lucia-vargas"
const U_KATERINE = "us-katerine-ospina"
// Casos de prueba de acceso: existen en el sistema pero no ven nada.
const U_SIN_EMPRESA = "us-sin-empresa"
const U_INVITADO = "us-sin-activar"

const NOW = "2026-08-15T09:00:00.000Z"
/** Fecha de los pantallazos del Excel. */
const REF_DATE = "2026-08-15"
const MONTH = "2026-08-01"

function id(prefix: string, ...parts: (string | number)[]) {
  return [prefix, ...parts].join("-")
}

/** Días hábiles del mes hasta la fecha de referencia (el Excel no reporta domingos). */
function businessDaysUpTo(reference: string): string[] {
  const [y, m] = reference.split("-").map(Number)
  const last = Number(reference.split("-")[2])
  const days: string[] = []
  for (let d = 1; d <= last; d++) {
    const date = new Date(Date.UTC(y, m - 1, d))
    if (date.getUTCDay() === 0) continue
    days.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
  }
  return days
}

const DAYS = businessDaysUpTo(REF_DATE)

/** Variación determinista: mismo seed → mismos datos en cada navegador. */
function jitter(seed: number, base: number, spread: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  const frac = x - Math.floor(x)
  return Math.max(0, Math.round(base + (frac - 0.5) * 2 * spread))
}

// ---------------------------------------------------------------
// KPI Diario
// ---------------------------------------------------------------
function buildDailyKpi(): DailyKpi[] {
  const rows: DailyKpi[] = []

  // Perfiles de referencia tomados de los pantallazos del 15/08.
  const people = [
    { userId: U_JUAN, name: "Nuñez Juan", companyId: RUTA_SEGURA, branchId: RS_BUGA, realizadas: 59, contestadas: 42, agendas: 0, atencion: 0, atendidos: 0, exitosas: 0, llamadaAgenda: 0, ventas: 0 },
    { userId: U_DANIELA, name: "Manzano Daniela", companyId: RUTA_SEGURA, branchId: RS_BUGA, realizadas: 37, contestadas: 25, agendas: 2, atencion: 2, atendidos: 2, exitosas: 2, llamadaAgenda: 1, ventas: 0 },
    { userId: U_KATERINE, name: "Katerine Ospina", companyId: RUTA_SEGURA, branchId: RS_TULUA, realizadas: 46, contestadas: 29, agendas: 2, atencion: 1, atendidos: 2, exitosas: 1, llamadaAgenda: 1, ventas: 1 },
    { userId: U_CARLOS, name: "Carlos Ríos", companyId: LV_UNION, branchId: LV_PRINCIPAL, realizadas: 44, contestadas: 31, agendas: 3, atencion: 2, atendidos: 3, exitosas: 1, llamadaAgenda: 2, ventas: 1 },
    { userId: U_LUCIA, name: "Lucía Vargas", companyId: LV_UNION, branchId: LV_PRINCIPAL, realizadas: 51, contestadas: 34, agendas: 1, atencion: 1, atendidos: 2, exitosas: 1, llamadaAgenda: 1, ventas: 1 },
  ]

  DAYS.forEach((date, dayIndex) => {
    const isRef = date === REF_DATE
    people.forEach((p, personIndex) => {
      const seed = dayIndex * 17 + personIndex * 7
      // El día de referencia usa los valores exactos del Excel; el resto varía.
      const realizadas = isRef ? p.realizadas : jitter(seed + 1, p.realizadas, 12)
      const contestadas = isRef
        ? p.contestadas
        : Math.min(realizadas, jitter(seed + 2, p.contestadas, 9))
      const atendidos = isRef ? p.atendidos : jitter(seed + 3, 3, 2)
      const agendas = isRef ? p.agendas : jitter(seed + 4, 2, 2)

      rows.push({
        id: id("kpi", date, p.userId),
        company_id: p.companyId,
        branch_id: p.branchId,
        report_date: date,
        user_id: p.userId,
        responsable_nombre: p.name,
        jornada: "final",
        llamadas_realizadas: realizadas,
        llamadas_contestadas: contestadas,
        ventas_efectivas: isRef ? p.ventas : jitter(seed + 5, 1, 1),
        agendas_dia: agendas,
        atencion_agendas: isRef ? p.atencion : Math.min(agendas, jitter(seed + 6, 1, 1)),
        clientes_atendidos: atendidos,
        ventas_exitosas: isRef ? p.exitosas : Math.min(atendidos, jitter(seed + 7, 1, 1)),
        llamada_agenda: isRef ? p.llamadaAgenda : jitter(seed + 8, 1, 1),
        created_at: `${date}T18:00:00.000Z`,
        updated_at: `${date}T18:00:00.000Z`,
      })
    })
  })

  return rows
}

// ---------------------------------------------------------------
// Gestión Diaria (CRM) — inicial vs final, como en el Excel
// ---------------------------------------------------------------
function buildDailyManagement(): DailyManagement[] {
  const rows: DailyManagement[] = []

  const people = [
    { userId: U_JUAN, name: "Nuñez Juan", companyId: RUTA_SEGURA, branchId: RS_BUGA },
    { userId: U_DANIELA, name: "Manzano Daniela", companyId: RUTA_SEGURA, branchId: RS_BUGA },
    { userId: U_KATERINE, name: "Katerine Ospina", companyId: RUTA_SEGURA, branchId: RS_TULUA },
    { userId: U_CARLOS, name: "Carlos Ríos", companyId: LV_UNION, branchId: LV_PRINCIPAL },
  ]

  DAYS.forEach((date, dayIndex) => {
    const isRef = date === REF_DATE
    people.forEach((p, personIndex) => {
      const seed = dayIndex * 23 + personIndex * 11

      // 15/08 Nuñez Juan: inicial 12/35/38 → final 0/0/0 (depuró todo).
      const inicial = {
        chats: isRef && p.userId === U_JUAN ? 12 : jitter(seed + 1, 10, 6),
        tareas: isRef && p.userId === U_JUAN ? 35 : jitter(seed + 2, 28, 12),
        caducadas: isRef && p.userId === U_JUAN ? 38 : jitter(seed + 3, 30, 14),
      }

      rows.push({
        id: id("dm", date, p.userId, "inicial"),
        company_id: p.companyId,
        branch_id: p.branchId,
        report_date: date,
        user_id: p.userId,
        responsable_nombre: p.name,
        jornada: "inicial",
        chats_por_responder: inicial.chats,
        tareas_del_dia: inicial.tareas,
        tareas_caducadas: inicial.caducadas,
        certificados: 0,
        created_at: `${date}T08:00:00.000Z`,
        updated_at: `${date}T08:00:00.000Z`,
      })

      const depurado = isRef && p.userId === U_JUAN
      rows.push({
        id: id("dm", date, p.userId, "final"),
        company_id: p.companyId,
        branch_id: p.branchId,
        report_date: date,
        user_id: p.userId,
        responsable_nombre: p.name,
        jornada: "final",
        chats_por_responder: depurado ? 0 : jitter(seed + 4, 2, 2),
        tareas_del_dia: depurado ? 0 : jitter(seed + 5, 3, 3),
        tareas_caducadas: depurado ? 0 : jitter(seed + 6, 4, 4),
        certificados: depurado ? 0 : jitter(seed + 7, 2, 2),
        created_at: `${date}T18:30:00.000Z`,
        updated_at: `${date}T18:30:00.000Z`,
      })
    })
  })

  return rows
}

// ---------------------------------------------------------------
// Reporte de Ventas
// Objetivo: que el acumulado de Ruta Segura en agosto cuadre con el
// "Reporte Mesual" del pantallazo (20 ventas / 25 licencias / $21.965.000).
// ---------------------------------------------------------------
function buildSales(): SalesEntry[] {
  const rows: SalesEntry[] = []

  // Distribución mensual objetivo de Ruta Segura, tomada del Excel.
  const monthlyTarget: Record<string, { ventas: number; licencias: number }> = {
    brilla: { ventas: 1, licencias: 1 },
    contado: { ventas: 12, licencias: 16 },
    cincuenta: { ventas: 2, licencias: 3 },
    sistecredito: { ventas: 5, licencias: 5 },
    addi: { ventas: 4, licencias: 4 },
    solvente: { ventas: 0, licencias: 0 },
  }

  // Reparto por días hábiles, dejando el 15/08 con lo del "Reporte Diario"
  // (1 venta y 1 licencia en Contado, más 1 crédito Brilla).
  const refDay: Record<string, { ventas: number; licencias: number }> = {
    brilla: { ventas: 1, licencias: 1 },
    contado: { ventas: 1, licencias: 1 },
  }

  Object.entries(monthlyTarget).forEach(([code, target]) => {
    const refVentas = refDay[code]?.ventas ?? 0
    const refLicencias = refDay[code]?.licencias ?? 0
    let restanteVentas = target.ventas - refVentas
    let restanteLicencias = target.licencias - refLicencias

    const otherDays = DAYS.filter((d) => d !== REF_DATE)

    // El día de referencia
    if (refVentas || refLicencias) {
      rows.push({
        id: id("se", REF_DATE, RUTA_SEGURA, code),
        company_id: RUTA_SEGURA,
        branch_id: RS_BUGA,
        report_date: REF_DATE,
        user_id: null,
        responsable_nombre: null,
        financing_code: code,
        kind: "venta",
        ventas: refVentas,
        licencias: refLicencias,
      })
    }

    // Se reparte el resto de atrás hacia adelante, una unidad por día,
    // para que el acumulado del mes cuadre exacto con el Excel.
    for (const date of otherDays) {
      if (restanteVentas <= 0 && restanteLicencias <= 0) break
      const ventas = restanteVentas > 0 ? 1 : 0
      const licencias = restanteLicencias > 0 ? 1 : 0
      restanteVentas -= ventas
      restanteLicencias -= licencias
      rows.push({
        id: id("se", date, RUTA_SEGURA, code),
        company_id: RUTA_SEGURA,
        branch_id: RS_BUGA,
        report_date: date,
        user_id: null,
        responsable_nombre: null,
        financing_code: code,
        kind: "venta",
        ventas,
        licencias,
      })
    }
  })

  // LV Unión: operación más pequeña, sin cuadre contra Excel.
  const lvCodes = ["contado", "sistecredito", "addi"]
  DAYS.forEach((date, dayIndex) => {
    lvCodes.forEach((code, i) => {
      const ventas = jitter(dayIndex * 5 + i, 0.6, 1)
      if (!ventas) return
      rows.push({
        id: id("se", date, LV_UNION, code),
        company_id: LV_UNION,
        branch_id: LV_PRINCIPAL,
        report_date: date,
        user_id: null,
        responsable_nombre: null,
        financing_code: code,
        kind: "venta",
        ventas,
        licencias: ventas,
      })
    })
  })

  return rows
}

/** Facturación mensual de Ruta Segura según el Excel: total $21.965.000. */
function buildBilling(): AmountEntry[] {
  const rows: AmountEntry[] = []

  const monthly: Record<string, number> = {
    brilla: 940_000,
    contado: 11_600_000,
    cincuenta: 2_543_000,
    sistecredito: 3_943_000,
    addi: 2_939_000,
    solvente: 0,
  }
  // 15/08 según el "Reporte Diario": Brilla 940.000 + Contado 694.000.
  const refDay: Record<string, number> = { brilla: 940_000, contado: 694_000 }

  const otherDays = DAYS.filter((d) => d !== REF_DATE)

  Object.entries(monthly).forEach(([code, total]) => {
    const ref = refDay[code] ?? 0
    if (ref > 0) {
      rows.push({
        id: id("bill", REF_DATE, RUTA_SEGURA, code),
        company_id: RUTA_SEGURA,
        branch_id: RS_BUGA,
        report_date: REF_DATE,
        code,
        amount: ref,
      })
    }
    const remaining = total - ref
    if (remaining <= 0) return

    // Reparto con variación, ajustando el último día para cuadrar el total exacto.
    const weights = otherDays.map((_, i) => 0.5 + (jitter(i * 3 + code.length, 50, 40) / 100))
    const weightSum = weights.reduce((a, b) => a + b, 0)
    let assigned = 0
    otherDays.forEach((date, i) => {
      const isLast = i === otherDays.length - 1
      const amount = isLast
        ? remaining - assigned
        : Math.round((remaining * weights[i]) / weightSum / 1000) * 1000
      assigned += amount
      if (amount <= 0) return
      rows.push({
        id: id("bill", date, RUTA_SEGURA, code),
        company_id: RUTA_SEGURA,
        branch_id: RS_BUGA,
        report_date: date,
        code,
        amount,
      })
    })
  })

  // LV Unión
  DAYS.forEach((date, i) => {
    const amount = jitter(i * 9, 420_000, 300_000)
    if (!amount) return
    rows.push({
      id: id("bill", date, LV_UNION, "contado"),
      company_id: LV_UNION,
      branch_id: LV_PRINCIPAL,
      report_date: date,
      code: "contado",
      amount: Math.round(amount / 1000) * 1000,
    })
  })

  return rows
}

/** Recaudo mensual de Ruta Segura según el Excel: total $7.423.000. */
function buildCollection(): AmountEntry[] {
  const rows: AmountEntry[] = []

  const monthly: Record<string, number> = {
    addi: 1_551_000,
    brilla: 0,
    datafono: 820_000,
    efectivo: 3_451_000,
    sistecredito: 2_421_000,
    solvente: 0,
    transferencia: 3_618_000,
  }
  // El 15/08 el Excel reporta recaudo diario en 0.
  const otherDays = DAYS.filter((d) => d !== REF_DATE)

  Object.entries(monthly).forEach(([code, total]) => {
    if (total <= 0) return
    const weights = otherDays.map((_, i) => 0.5 + jitter(i * 7 + code.length, 50, 45) / 100)
    const weightSum = weights.reduce((a, b) => a + b, 0)
    let assigned = 0
    otherDays.forEach((date, i) => {
      const isLast = i === otherDays.length - 1
      const amount = isLast
        ? total - assigned
        : Math.round((total * weights[i]) / weightSum / 1000) * 1000
      assigned += amount
      if (amount <= 0) return
      rows.push({
        id: id("coll", date, RUTA_SEGURA, code),
        company_id: RUTA_SEGURA,
        branch_id: RS_BUGA,
        report_date: date,
        code,
        amount,
      })
    })
  })

  DAYS.forEach((date, i) => {
    const amount = jitter(i * 13, 300_000, 250_000)
    if (!amount) return
    rows.push({
      id: id("coll", date, LV_UNION, "efectivo"),
      company_id: LV_UNION,
      branch_id: LV_PRINCIPAL,
      report_date: date,
      code: "efectivo",
      amount: Math.round(amount / 1000) * 1000,
    })
  })

  return rows
}

// ---------------------------------------------------------------
// Base completa
// ---------------------------------------------------------------
export function buildSeedDatabase(): Database {
  return {
    version: SEED_VERSION,
    current_user_id: U_JONNIER,

    profiles: [
      { id: U_JONNIER, full_name: "Jonnier A. Martínez", email: "jonnieralejandrom@gmail.com", role: "super_admin", status: "activo", created_at: NOW },
      { id: U_JUAN, full_name: "Nuñez Juan", email: "juan.nunez@tramitesbuga.co", role: "asesor", status: "activo", created_at: NOW },
      { id: U_DANIELA, full_name: "Manzano Daniela", email: "daniela.manzano@tramitesbuga.co", role: "coordinador", status: "activo", created_at: NOW },
      { id: U_CARLOS, full_name: "Carlos Ríos", email: "carlos.rios@tramitesbuga.co", role: "asesor", status: "activo", created_at: NOW },
      { id: U_LUCIA, full_name: "Lucía Vargas", email: "lucia.vargas@tramitesbuga.co", role: "asesor", status: "invitado", created_at: NOW },
      { id: U_KATERINE, full_name: "Katerine Ospina", email: "katerine.ospina@tramitesbuga.co", role: "asesor", status: "activo", created_at: NOW },

      // Usuario activo y sin ninguna empresa asignada. Puede entrar pero no ve
      // ningún dato: es el caso que verifica que los permisos cierran bien.
      { id: U_SIN_EMPRESA, full_name: "Pedro Salazar", email: "pedro.salazar@tramitesbuga.co", role: "asesor", status: "activo", created_at: NOW },

      // Usuario invitado que nunca definió contraseña. En producción `is_active_user()`
      // es falso para él, así que RLS le niega incluso los catálogos.
      { id: U_INVITADO, full_name: "Marcela Ruiz", email: "marcela.ruiz@tramitesbuga.co", role: "asesor", status: "invitado", created_at: NOW },
    ],

    companies: [
      { id: RUTA_SEGURA, name: "Ruta Segura", slug: "ruta-segura", nit: "901.234.567-1", city: "Buga", department: "Valle del Cauca", accent_color: "#0f766e", crm_label: "Ruta Segura", status: "activa", created_at: NOW },
      { id: LV_UNION, name: "LV Unión", slug: "lv-union", nit: "901.987.654-3", city: "Buga", department: "Valle del Cauca", accent_color: "#7c3aed", crm_label: "LV Unión", status: "activa", created_at: NOW },
    ],

    branches: [
      { id: RS_BUGA, company_id: RUTA_SEGURA, name: "Sede Buga", city: "Buga", department: "Valle del Cauca", is_primary: true, status: "activa", created_at: NOW },
      { id: RS_TULUA, company_id: RUTA_SEGURA, name: "Sede Tuluá", city: "Tuluá", department: "Valle del Cauca", is_primary: false, status: "activa", created_at: NOW },
      { id: LV_PRINCIPAL, company_id: LV_UNION, name: "Sede principal", city: "Buga", department: "Valle del Cauca", is_primary: true, status: "activa", created_at: NOW },
    ],

    company_modules: [
      { company_id: RUTA_SEGURA, module_code: "kpi_diario" },
      { company_id: RUTA_SEGURA, module_code: "gestion_diaria" },
      { company_id: RUTA_SEGURA, module_code: "reporte_ventas" },
      { company_id: LV_UNION, module_code: "kpi_diario" },
      { company_id: LV_UNION, module_code: "gestion_diaria" },
    ],

    company_users: [
      { company_id: RUTA_SEGURA, user_id: U_JUAN, branch_id: RS_BUGA, role: "asesor" },
      { company_id: RUTA_SEGURA, user_id: U_DANIELA, branch_id: RS_BUGA, role: "coordinador" },
      { company_id: RUTA_SEGURA, user_id: U_KATERINE, branch_id: RS_TULUA, role: "asesor" },
      { company_id: LV_UNION, user_id: U_CARLOS, branch_id: LV_PRINCIPAL, role: "asesor" },
      { company_id: LV_UNION, user_id: U_LUCIA, branch_id: LV_PRINCIPAL, role: "asesor" },
      // Coordinadora sin sede: supervisa la empresa completa.
      { company_id: LV_UNION, user_id: U_DANIELA, branch_id: null, role: "coordinador" },
    ],

    financing_types: [
      { code: "brilla", name: "Brilla", sort_order: 1 },
      { code: "contado", name: "Contado", sort_order: 2 },
      { code: "cincuenta", name: "50/50", sort_order: 3 },
      { code: "sistecredito", name: "Sistecrédito", sort_order: 4 },
      { code: "addi", name: "Addi", sort_order: 5 },
      { code: "solvente", name: "Solvente", sort_order: 6 },
    ],

    payment_methods: [
      { code: "addi", name: "Addi", sort_order: 1 },
      { code: "brilla", name: "Brilla", sort_order: 2 },
      { code: "datafono", name: "Datáfono", sort_order: 3 },
      { code: "efectivo", name: "Efectivo", sort_order: 4 },
      { code: "sistecredito", name: "Sistecrédito", sort_order: 5 },
      { code: "solvente", name: "Solvente", sort_order: 6 },
      { code: "transferencia", name: "Transferencia", sort_order: 7 },
    ],

    company_financing_types: [RUTA_SEGURA, LV_UNION].flatMap((company_id) =>
      ["brilla", "contado", "cincuenta", "sistecredito", "addi", "solvente"].map((code) => ({
        company_id,
        code,
        active: !(company_id === LV_UNION && (code === "brilla" || code === "solvente")),
      })),
    ),

    company_payment_methods: [RUTA_SEGURA, LV_UNION].flatMap((company_id) =>
      ["addi", "brilla", "datafono", "efectivo", "sistecredito", "solvente", "transferencia"].map(
        (code) => ({ company_id, code, active: true }),
      ),
    ),

    daily_kpi: buildDailyKpi(),
    daily_management: buildDailyManagement(),
    sales_entries: buildSales(),
    billing_entries: buildBilling(),
    collection_entries: buildCollection(),

    metrics: [
      { code: "ventas_mensuales", name: "Ventas mensuales", unit: "cantidad", sort_order: 1 },
      { code: "licencias_mensuales", name: "Licencias mensuales", unit: "cantidad", sort_order: 2 },
      { code: "facturacion", name: "Facturación", unit: "moneda", sort_order: 3 },
      { code: "recaudo", name: "Recaudo", unit: "moneda", sort_order: 4 },
      { code: "ventas_efectivas", name: "Ventas efectivas (llamada)", unit: "cantidad", sort_order: 5 },
      { code: "ratio_contactabilidad", name: "Ratio contactabilidad", unit: "porcentaje", sort_order: 6 },
      { code: "ratio_conversion_llamada", name: "Ratio conversión llamada", unit: "porcentaje", sort_order: 7 },
    ],

    objectives: [
      { id: "ob-1", company_id: RUTA_SEGURA, period_month: MONTH, metric_code: "ventas_mensuales", user_id: null, target_value: 30, locked: false },
      { id: "ob-2", company_id: RUTA_SEGURA, period_month: MONTH, metric_code: "licencias_mensuales", user_id: null, target_value: 40, locked: false },
      { id: "ob-3", company_id: RUTA_SEGURA, period_month: MONTH, metric_code: "facturacion", user_id: null, target_value: 30_000_000, locked: false },
      { id: "ob-4", company_id: RUTA_SEGURA, period_month: MONTH, metric_code: "recaudo", user_id: null, target_value: 12_000_000, locked: false },
      { id: "ob-5", company_id: RUTA_SEGURA, period_month: MONTH, metric_code: "ratio_contactabilidad", user_id: U_JUAN, target_value: 75, locked: false },
      { id: "ob-6", company_id: RUTA_SEGURA, period_month: MONTH, metric_code: "ratio_contactabilidad", user_id: U_DANIELA, target_value: 75, locked: false },
      { id: "ob-7", company_id: LV_UNION, period_month: MONTH, metric_code: "ventas_mensuales", user_id: null, target_value: 15, locked: false },
      { id: "ob-8", company_id: LV_UNION, period_month: MONTH, metric_code: "facturacion", user_id: null, target_value: 8_000_000, locked: false },
    ],

    audit_log: [],
  }
}

export const REFERENCE_DATE = REF_DATE
export const REFERENCE_MONTH = MONTH
