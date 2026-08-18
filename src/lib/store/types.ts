/**
 * Modelo de dominio de la interfaz.
 *
 * Es un espejo de `supabase/migrations/`, con las comodidades que la app
 * necesita: opcionales en vez de null donde da igual. Los tipos generados de la
 * base viven en `src/lib/supabase/database.types.ts` y se usan en la capa de
 * datos; estos son los que consumen las pantallas.
 *
 * Solo están acá los datos de referencia —los que caben en memoria y hacen
 * falta para pintar cualquier pantalla—. Las ventas, los pagos y la actividad
 * diaria son decenas de miles de filas: esas se consultan por página, con sus
 * filtros, en el servidor.
 */

export type UserRole = "super_admin" | "coordinador" | "asesor"
export type UserStatus = "invitado" | "activo" | "inactivo" | "eliminado"
export type CompanyStatus = "activa" | "archivada"
export type MetricUnit = "cantidad" | "moneda" | "porcentaje"

export type ModuleCode = "ventas" | "pagos" | "actividad_diaria" | "agendas" | "caja"

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

/**
 * Persona que aparece como responsable de un registro.
 *
 * Existe tenga o no cuenta de acceso: en el histórico hay 123 comerciales y
 * casi ninguno va a entrar nunca a la aplicación. `profile_id` la conecta con
 * su cuenta el día que la tenga.
 */
export interface Staff {
  id: string
  full_name: string
  slug: string
  profile_id?: string | null
  active: boolean
}

export interface CompanyStaff {
  company_id: string
  staff_id: string
  branch_id?: string | null
}

export interface Company {
  id: string
  name: string
  slug: string
  nit?: string
  city?: string
  department?: string
  /** Logo subido a Storage. Si no hay, la empresa se muestra con sus iniciales. */
  logo_url?: string | null
  accent_color: string
  crm_label?: string
  /** Hora esperada de entrada. De acá sale el indicador de llegadas tarde. */
  hora_entrada: string
  status: CompanyStatus
  archived_at?: string | null
  created_at: string
}

export interface Branch {
  id: string
  company_id: string
  name: string
  city?: string
  department?: string
  is_primary: boolean
  status: CompanyStatus
  created_at: string
}

export interface CompanyModule {
  company_id: string
  module_code: ModuleCode
}

export interface CompanyUser {
  company_id: string
  user_id: string
  branch_id?: string | null
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

export interface Metric {
  code: string
  name: string
  unit: MetricUnit
  sort_order: number
}

/** Datos de referencia. Se cargan una vez por petición en el layout con sesión. */
export interface Database {
  profiles: Profile[]
  staff: Staff[]
  company_staff: CompanyStaff[]
  companies: Company[]
  branches: Branch[]
  company_modules: CompanyModule[]
  company_users: CompanyUser[]
  financing_types: CatalogItem[]
  payment_methods: CatalogItem[]
  /** Qué financiaciones y medios de pago usa cada empresa. */
  company_financing_types: CompanyCatalogItem[]
  company_payment_methods: CompanyCatalogItem[]
  products: CatalogItem[]
  schools: CatalogItem[]
  channels: CatalogItem[]
  sale_states: CatalogItem[]
  cash_concepts: CatalogItem[]
  metrics: Metric[]
}

export const MODULES: { code: ModuleCode; name: string; description: string }[] = [
  {
    code: "ventas",
    name: "Ventas",
    description: "Créditos y licencias vendidas: cliente, producto, escuela, valores, recaudo y saldo.",
  },
  {
    code: "pagos",
    name: "Pagos",
    description: "Abonos recibidos contra cada crédito, por medio de pago.",
  },
  {
    code: "actividad_diaria",
    name: "Gestión Diaria",
    description: "Jornada, cola del CRM, agendas, llamadas y atenciones por persona y día.",
  },
  {
    code: "agendas",
    name: "Agendas",
    description: "Citas concertadas con clientes y su resultado.",
  },
  {
    code: "caja",
    name: "Ingreso y Gasto",
    description: "Movimientos de caja: entradas y salidas por concepto y medio de pago.",
  },
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
