import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { KommoIntegracion } from "@/components/kommo/kommo-integracion"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getCompanyContext } from "@/lib/data/company"
import type { ConfigKommo } from "@/lib/kommo"
import { createClient } from "@/lib/supabase/server"

/**
 * Integración con Kommo de una empresa.
 *
 * Cada oficina tiene su propia cuenta de Kommo, así que la conexión es de la
 * empresa y no de la instalación. El token no llega a esta página: la columna
 * no se puede leer desde la API (048), solo sus últimos cuatro caracteres.
 */
export default async function KommoPage({ params }: PageProps<"/e/[slug]/kommo">) {
  const { slug } = await params
  const company = await getCompanyContext(slug)
  if (!company) notFound()

  if (!company.canManage) {
    return (
      <Alert>
        <AlertDescription>
          La integración con Kommo de {company.name} la administra un coordinador o el super admin.
        </AlertDescription>
      </Alert>
    )
  }

  const supabase = await createClient()
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? ""
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("192.168.") ? "http" : "https")
  const [{ data }, { data: avisos }] = await Promise.all([
    supabase
      .from("kommo_integrations")
      .select("subdomain, token_hint, config, last_sync_at, last_sync_count, last_error, webhook_ultimo_at")
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase
      .from("kommo_eventos")
      .select("id, recibido_at, entidad, accion, entity_id, error")
      .eq("company_id", company.id)
      .order("recibido_at", { ascending: false })
      .limit(8),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Kommo"
        description={`Conexión de ${company.name} con su cuenta de Kommo, de donde salen las agendas.`}
      />
      <KommoIntegracion
        companyId={company.id}
        isSuperAdmin={company.isSuperAdmin}
        branches={company.branches}
        staff={company.staff}
        avisos={avisos ?? []}
        urlApp={`${proto}://${host}`}
        integracion={
          data
            ? {
                subdomain: data.subdomain,
                token_hint: data.token_hint,
                config: (data.config ?? {}) as unknown as Partial<ConfigKommo>,
                last_sync_at: data.last_sync_at,
                last_sync_count: data.last_sync_count,
                last_error: data.last_error,
                webhook_ultimo_at: data.webhook_ultimo_at,
              }
            : null
        }
      />
    </div>
  )
}
