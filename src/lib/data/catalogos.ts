import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

type Fila<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]

/** Las tablas de referencia que son iguales para todo el mundo. */
export interface Catalogos {
  financing_types: Fila<"financing_types">[]
  payment_methods: Fila<"payment_methods">[]
  products: Fila<"products">[]
  schools: Fila<"schools">[]
  channels: Fila<"channels">[]
  sale_states: Fila<"sale_states">[]
  cash_concepts: Fila<"cash_concepts">[]
  metrics: Fila<"metrics">[]
  traffic_sources: Fila<"traffic_sources">[]
  ad_categories: Fila<"ad_categories">[]
  sale_types: Fila<"sale_types">[]
  medical_centers: Fila<"medical_centers">[]
  id_types: Fila<"id_types">[]
}

/**
 * Cuánto tiempo se reutiliza una lectura. Los catálogos solo cambian por SQL,
 * a mano y muy de vez en cuando; diez minutos de desfase no le pesan a nadie.
 */
const VIGENCIA_MS = 10 * 60 * 1000

let memoria: { datos: Catalogos; vence: number } | null = null
let enCurso: Promise<Catalogos> | null = null

/**
 * Los catálogos globales, leídos una vez y compartidos entre peticiones.
 *
 * Antes cada navegación pedía estas trece tablas de nuevo —desde el layout y
 * otra vez desde el contexto de empresa— y con treinta usuarios eso sumaba
 * decenas de miles de peticiones por hora contra una instancia pequeña, que
 * terminaba respondiendo 52x. Las filas son las mismas para cualquier sesión
 * activa (las políticas solo exigen `is_active_user()`), así que guardarlas en
 * memoria del módulo no mezcla datos de nadie con nadie.
 *
 * Si la lectura falla o viene vacía no se guarda: una sesión sin permisos no
 * debe dejar a los demás diez minutos sin catálogos.
 */
export async function cargarCatalogos(supabase: SupabaseClient<Database>): Promise<Catalogos> {
  if (memoria && memoria.vence > Date.now()) return memoria.datos
  if (enCurso) return enCurso

  enCurso = consultar(supabase)
    .then(({ datos, completo }) => {
      if (completo) memoria = { datos, vence: Date.now() + VIGENCIA_MS }
      return datos
    })
    .finally(() => {
      enCurso = null
    })

  return enCurso
}

async function consultar(
  supabase: SupabaseClient<Database>,
): Promise<{ datos: Catalogos; completo: boolean }> {
  const [
    financing_types,
    payment_methods,
    products,
    schools,
    channels,
    sale_states,
    cash_concepts,
    metrics,
    traffic_sources,
    ad_categories,
    sale_types,
    medical_centers,
    id_types,
  ] = await Promise.all([
    supabase.from("financing_types").select("*").order("sort_order"),
    supabase.from("payment_methods").select("*").order("sort_order"),
    supabase.from("products").select("*").order("sort_order"),
    supabase.from("schools").select("*").order("sort_order"),
    supabase.from("channels").select("*").order("sort_order"),
    supabase.from("sale_states").select("*").order("sort_order"),
    supabase.from("cash_concepts").select("*").order("sort_order"),
    supabase.from("metrics").select("*").order("sort_order"),
    supabase.from("traffic_sources").select("*").order("sort_order"),
    supabase.from("ad_categories").select("*").order("sort_order"),
    supabase.from("sale_types").select("*").order("sort_order"),
    supabase.from("medical_centers").select("*").order("sort_order"),
    supabase.from("id_types").select("*").order("sort_order"),
  ])

  const resultados = {
    financing_types,
    payment_methods,
    products,
    schools,
    channels,
    sale_states,
    cash_concepts,
    metrics,
    traffic_sources,
    ad_categories,
    sale_types,
    medical_centers,
    id_types,
  }

  const lecturas = Object.values(resultados)
  return {
    datos: Object.fromEntries(
      Object.entries(resultados).map(([tabla, r]) => [tabla, r.data ?? []]),
    ) as unknown as Catalogos,
    // Igual que antes, un error deja la lista vacía para esa petición; lo que
    // no se hace es recordarlo.
    completo: lecturas.every((r) => !r.error) && lecturas.some((r) => (r.data ?? []).length > 0),
  }
}
