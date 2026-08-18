/**
 * Modelo de dominio de la interfaz. Espejo de `supabase/migrations/001_schema.sql`,
 * pero con las comodidades que la app necesita: opcionales en vez de null y un
 * solo tipo para facturación y recaudo, que en Postgres son dos tablas.
 *
 * Los tipos generados de la base viven en `src/lib/supabase/database.types.ts`
 * y se usan en la capa de datos; estos son los que consumen las pantallas.
 */

export type UserRole = "super_admin" | "coordinador" | "asesor"
export type UserStatus = "invitado" | "activo" | "inactivo" | "eliminado"
export type CompanyStatus = "activa" | "archivada"
export type Jornada = "inicial" | "medio_dia" | "final"
export type VentaKind = "venta" | "renovacion"
export type MetricUnit = "cantidad" | "moneda" | "porcentaje"
export type ModuleCode = "kpi_diario" | "gestion_diaria" | "reporte_ventas"

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  role: UserRole
  status: UserStatus
  /** Baja lógica: la fila nunca se borra para que el histórico conserve el nombre. */
  deleted_at?: string | null
  deleted_by?: string | null
  created_at: string
}

export interface Company {
  id: string
  name: string
  slug: string
  nit?: string
  city?: string
  /** Departamento del municipio. Necesario porque hay nombres repetidos. */
  department?: string
  /** Logo subido a Storage. Si no hay, la empresa se muestra con sus iniciales. */
  logo_url?: string | null
  accent_color: string
  /** Nombre del CRM que usa la empresa (aparece como "CRM - LV Unión" en el Excel). */
  crm_label?: string
  status: CompanyStatus
  archived_at?: string | null
  created_at: string
}

/**
 * Sede de una empresa cliente. Una empresa tiene una o varias sedes y los
 * comerciales se asignan a una sede, no directamente a la empresa. El dashboard
 * de la empresa es la suma de sus sedes.
 */
export interface Branch {
  id: string
  company_id: string
  name: string
  city?: string
  department?: string
  /** Marca la sede por defecto para empresas de una sola ubicación. */
  is_primary: boolean
  status: "activa" | "archivada"
  created_at: string
}

export interface CompanyModule {
  company_id: string
  module_code: ModuleCode
}

export interface CompanyUser {
  company_id: string
  user_id: string
  /**
   * Sede a la que pertenece el comercial. Un coordinador puede quedar sin sede
   * (null) cuando supervisa la empresa completa.
   */
  branch_id?: string | null
  /** Rol dentro de esta empresa. `super_admin` es global y no se guarda acá. */
  role: Exclude<UserRole, "super_admin">
  removed_at?: string | null
}

export interface CatalogItem {
  code: string
  name: string
  sort_order: number
}

export interface CompanyCatalogItem {
  company_id: string
  code: string
  active: boolean
}

/** Base común de todos los registros de captura. */
interface DailyRecordBase {
  id: string
  company_id: string
  /** Sede donde se generó el registro. Permite desglosar el dashboard por sede. */
  branch_id: string
  report_date: string // YYYY-MM-DD
  user_id: string
  /** Snapshot del nombre: el reporte histórico no cambia si renombran o eliminan el perfil. */
  responsable_nombre: string
  jornada: Jornada
  notas?: string
  created_at: string
  updated_at: string
}

export interface DailyKpi extends DailyRecordBase {
  llamadas_realizadas: number
  llamadas_contestadas: number
  ventas_efectivas: number
  agendas_dia: number
  atencion_agendas: number
  clientes_atendidos: number
  ventas_exitosas: number
  llamada_agenda: number
}

export interface DailyManagement extends DailyRecordBase {
  chats_por_responder: number
  tareas_del_dia: number
  tareas_caducadas: number
  certificados: number
}

export interface SalesEntry {
  id: string
  company_id: string
  branch_id: string
  report_date: string
  user_id?: string | null
  responsable_nombre?: string | null
  financing_code: string
  kind: VentaKind
  ventas: number
  licencias: number
}

export interface AmountEntry {
  id: string
  company_id: string
  branch_id: string
  report_date: string
  /** Financiación (facturación) o medio de pago (recaudo). */
  code: string
  amount: number
}

export interface Metric {
  code: string
  name: string
  unit: MetricUnit
  sort_order: number
}

export interface Objective {
  id: string
  company_id: string
  /** Primer día del mes: YYYY-MM-01 */
  period_month: string
  metric_code: string
  /** null = meta de la empresa completa. */
  user_id?: string | null
  target_value: number
  locked: boolean
}

/**
 * Todo el estado de la app, tal como se lee de Supabase.
 *
 * Es un espejo de las tablas de Postgres, no un almacén aparte: se carga en el
 * layout con sesión y se baja por contexto. No hay copia local de nada.
 */
export interface Database {
  profiles: Profile[]
  companies: Company[]
  branches: Branch[]
  company_modules: CompanyModule[]
  company_users: CompanyUser[]
  financing_types: CatalogItem[]
  payment_methods: CatalogItem[]
  company_financing_types: CompanyCatalogItem[]
  company_payment_methods: CompanyCatalogItem[]
  daily_kpi: DailyKpi[]
  daily_management: DailyManagement[]
  sales_entries: SalesEntry[]
  billing_entries: AmountEntry[]
  collection_entries: AmountEntry[]
  metrics: Metric[]
  objectives: Objective[]
}

export const MODULES: { code: ModuleCode; name: string; description: string }[] = [
  {
    code: "kpi_diario",
    name: "KPI Diario",
    description: "Llamadas, ventas, agendas y venta presencial por jornada. Calcula los seis ratios.",
  },
  {
    code: "gestion_diaria",
    name: "Gestión Diaria (CRM)",
    description: "Chats por responder, tareas del día, tareas caducadas y certificados.",
  },
  {
    code: "reporte_ventas",
    name: "Reporte de Ventas",
    description: "Ventas y licencias por financiación, renovaciones, facturación y recaudo.",
  },
]

export const JORNADAS: { value: Jornada; label: string }[] = [
  { value: "inicial", label: "Inicial" },
  { value: "medio_dia", label: "Medio día" },
  { value: "final", label: "Final" },
]

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  coordinador: "Coordinador",
  asesor: "Asesor",
}

export const STATUS_LABELS: Record<UserStatus, string> = {
  invitado: "Invitado",
  activo: "Activo",
  inactivo: "Inactivo",
  eliminado: "Eliminado",
}
