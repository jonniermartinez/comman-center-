import "server-only"

import { createClient } from "@/lib/supabase/server"

export interface BonoDeProducto {
  id: string
  name: string
  amount: number
  active: boolean
}

export interface ProductoDeEmpresa {
  id: string
  name: string
  price: number
  is_renovacion: boolean
  catalog_code: string | null
  active: boolean
  sort_order: number
  bonos: BonoDeProducto[]
  /** Cuántas ventas lo usan. Decide si se puede borrar o solo archivar. */
  ventas: number
}

/**
 * La lista de precios de una empresa, con los bonos de cada producto.
 *
 * Va en una sola consulta con el join anidado de PostgREST porque la lista es
 * corta —una oficina vende diez o quince cosas— y partirla en dos viajes solo
 * serviría para que la pantalla se pinte a medias.
 */
export async function listCompanyProducts(companyId: string): Promise<ProductoDeEmpresa[]> {
  const supabase = await createClient()

  const [{ data }, { data: usos }] = await Promise.all([
    supabase
      .from("company_products")
      .select(
        "id, name, price, is_renovacion, catalog_code, active, sort_order, company_product_bonuses(id, name, amount, active, sort_order)",
      )
      .eq("company_id", companyId)
      .order("sort_order")
      .order("name"),
    supabase.from("sales").select("company_product_id").eq("company_id", companyId),
  ])

  const cuenta = new Map<string, number>()
  for (const fila of usos ?? []) {
    if (fila.company_product_id) {
      cuenta.set(fila.company_product_id, (cuenta.get(fila.company_product_id) ?? 0) + 1)
    }
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    is_renovacion: p.is_renovacion,
    catalog_code: p.catalog_code,
    active: p.active,
    sort_order: p.sort_order,
    ventas: cuenta.get(p.id) ?? 0,
    bonos: (p.company_product_bonuses ?? [])
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((b) => ({ id: b.id, name: b.name, amount: Number(b.amount), active: b.active })),
  }))
}
