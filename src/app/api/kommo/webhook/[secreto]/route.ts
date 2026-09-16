import { createClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

import type { Database } from "@/lib/supabase/database.types"

type Nodo = { [clave: string]: Nodo | string }

/**
 * `leads[status][0][id]=5` → `{ leads: { status: [{ id: "5" }] } }`.
 *
 * Kommo manda el webhook como formulario, no como JSON. Las claves numéricas
 * se vuelven arreglos al final, que es la forma que espera la base.
 */
function desdeFormulario(form: URLSearchParams): unknown {
  const raiz: Nodo = {}
  for (const [clave, valor] of form) {
    const partes = clave.replace(/\]/g, "").split("[")
    let nodo = raiz
    partes.forEach((parte, i) => {
      if (i === partes.length - 1) {
        nodo[parte] = valor
        return
      }
      if (typeof nodo[parte] !== "object") nodo[parte] = {}
      nodo = nodo[parte] as Nodo
    })
  }

  const arreglos = (n: Nodo | string): unknown => {
    if (typeof n === "string") return n
    const claves = Object.keys(n)
    const valores = claves.map((k) => arreglos(n[k]))
    if (claves.length > 0 && claves.every((k) => /^\d+$/.test(k))) {
      return claves
        .map((k, i) => [Number(k), valores[i]] as const)
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => v)
    }
    return Object.fromEntries(claves.map((k, i) => [k, valores[i]]))
  }
  return arreglos(raiz)
}

/**
 * Recibe los avisos de Kommo de una empresa.
 *
 * No hay sesión: el secreto de la URL identifica a la empresa, y la base lo
 * valida en `kommo_webhook_recibir` (047). Se responde rápido para que Kommo no
 * lo marque como caído; si la base falla se responde 500 y Kommo reintenta.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/kommo/webhook/[secreto]">) {
  const { secreto } = await ctx.params

  const tipo = request.headers.get("content-type") ?? ""
  const texto = await request.text()
  let payload: unknown
  try {
    payload = tipo.includes("application/json")
      ? JSON.parse(texto)
      : desdeFormulario(new URLSearchParams(texto))
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await supabase.rpc("kommo_webhook_recibir", {
    p_secreto: secreto,
    p_payload: payload as never,
  })

  if (error) {
    if (error.message.includes("Webhook desconocido")) {
      return Response.json({ ok: false }, { status: 404 })
    }
    console.error("kommo webhook:", error.message)
    return Response.json({ ok: false }, { status: 500 })
  }

  return Response.json({ ok: true, avisos: data })
}
