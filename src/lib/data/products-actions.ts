"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { logAudit } from "@/lib/data/audit"
import { createClient } from "@/lib/supabase/server"

export interface Result {
  ok: boolean
  error?: string
}

function refrescar() {
  revalidatePath("/", "layout")
}

/** Un bono tal como llega del formulario: los que ya existen traen su id. */
export interface BonoInput {
  id?: string
  name: string
  amount: number
  active?: boolean
}

export interface ProductoInput {
  id?: string
  company_id: string
  name: string
  price: number
  is_renovacion: boolean
  catalog_code?: string | null
  active?: boolean
  sort_order?: number
  bonos: BonoInput[]
}

/**
 * Alta o corrección de un producto de la lista de precios de una empresa, con
 * sus bonos.
 *
 * Los bonos van en la misma operación porque para el usuario son parte del
 * producto: "el curso A2 vale 1.200.000 y admite el bono de referido". Guardar
 * el producto y después entrar a otra pantalla a ponerle los bonos es partir en
 * dos algo que se piensa junto.
 */
export async function saveCompanyProduct(input: ProductoInput): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const nombre = input.name.trim()
  if (nombre.length < 2) return { ok: false, error: "El producto necesita un nombre." }
  if (input.price < 0) return { ok: false, error: "El precio no puede ser negativo." }

  const fila = {
    company_id: input.company_id,
    name: nombre,
    price: input.price,
    is_renovacion: input.is_renovacion,
    catalog_code: input.catalog_code || null,
    active: input.active ?? true,
    sort_order: input.sort_order ?? 0,
    updated_at: new Date().toISOString(),
    updated_by: session.profile.id,
  }

  const { data, error } = input.id
    ? await supabase.from("company_products").update(fila).eq("id", input.id).select("id").single()
    : await supabase
        .from("company_products")
        .insert({ ...fila, created_by: session.profile.id })
        .select("id")
        .single()

  if (error) return { ok: false, error: explicar(error.message) }

  const productId = data.id

  // Los bonos que el formulario ya no trae se borran: quitar una línea en
  // pantalla y que siga viva en la base sería mentirle al que la quitó. Las
  // ventas que lo usaron no se tocan, porque guardan su propia copia del
  // nombre y del valor (038).
  const conservados = input.bonos.map((b) => b.id).filter((id): id is string => !!id)
  const borrado = conservados.length
    ? await supabase
        .from("company_product_bonuses")
        .delete()
        .eq("product_id", productId)
        .not("id", "in", `(${conservados.join(",")})`)
    : await supabase.from("company_product_bonuses").delete().eq("product_id", productId)

  if (borrado.error) return { ok: false, error: explicar(borrado.error.message) }

  // Los bonos nuevos se insertan y los que ya existían se actualizan, por
  // separado. Un upsert con todo junto no sirve: supabase-js iguala las claves
  // de todas las filas del lote, así que el `id` ausente de un bono nuevo
  // viajaría como null y chocaría contra la llave primaria.
  const filaBono = (b: BonoInput, i: number) => ({
    product_id: productId,
    company_id: input.company_id,
    name: b.name.trim(),
    amount: b.amount,
    active: b.active ?? true,
    sort_order: i,
    updated_at: new Date().toISOString(),
  })

  const nuevos = input.bonos.map((b, i) => ({ bono: b, i })).filter(({ bono }) => !bono.id)
  if (nuevos.length) {
    const { error: e } = await supabase
      .from("company_product_bonuses")
      .insert(nuevos.map(({ bono, i }) => filaBono(bono, i)))
    if (e) return { ok: false, error: explicar(e.message) }
  }

  for (const [i, bono] of input.bonos.entries()) {
    if (!bono.id) continue
    const { error: e } = await supabase
      .from("company_product_bonuses")
      .update(filaBono(bono, i))
      .eq("id", bono.id)
    if (e) return { ok: false, error: explicar(e.message) }
  }

  await logAudit({
    action: input.id ? "update" : "create",
    entity: "company_products",
    entity_id: productId,
    company_id: input.company_id,
    after: { name: nombre, price: input.price, bonos: input.bonos.length },
  })

  refrescar()
  return { ok: true }
}

/**
 * Saca un producto de la lista sin borrarlo.
 *
 * Se archiva en vez de borrarse porque las ventas viejas apuntan a él: borrarlo
 * dejaría esas ventas sin nombre de producto. Archivado deja de aparecer al
 * registrar una venta nueva, que es lo que se quiere.
 */
export async function archiveCompanyProduct(id: string, archivar: boolean): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("company_products")
    .update({ active: !archivar, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("company_id, name")
    .single()

  if (error) return { ok: false, error: explicar(error.message) }

  await logAudit({
    action: "update",
    entity: "company_products",
    entity_id: id,
    company_id: data.company_id,
    after: { active: !archivar },
  })

  refrescar()
  return { ok: true }
}

/** Borra un producto que nunca se usó. Si tiene ventas, se archiva. */
export async function deleteCompanyProduct(id: string): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { count } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("company_product_id", id)

  if (count) {
    return {
      ok: false,
      error: `Ese producto ya tiene ${count} venta${count === 1 ? "" : "s"}. Archívalo en vez de borrarlo: si lo borras, esas ventas se quedan sin producto.`,
    }
  }

  const { data, error } = await supabase
    .from("company_products")
    .delete()
    .eq("id", id)
    .select("company_id, name")
    .single()

  if (error) return { ok: false, error: explicar(error.message) }

  await logAudit({
    action: "delete",
    entity: "company_products",
    entity_id: id,
    company_id: data.company_id,
    before: { name: data.name },
  })

  refrescar()
  return { ok: true }
}

/** Traduce lo que dice Postgres a lo que le sirve a quien está en la pantalla. */
function explicar(mensaje: string): string {
  if (mensaje.includes("company_products_nombre_idx")) {
    return "Ya existe un producto con ese nombre en esta empresa."
  }
  if (mensaje.includes("row-level security")) {
    return "Administrar la lista de productos requiere rol de coordinador o super admin."
  }
  return mensaje
}
