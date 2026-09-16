import { ExternalLink } from "lucide-react"
import { notFound } from "next/navigation"

import { SincronizarKommo } from "@/components/kommo/sincronizar-kommo"
import { ModuleMissing } from "@/components/module-missing"
import { RecordFilters } from "@/components/record-filters"
import { EmptyRow, RecordsScaffold } from "@/components/records-scaffold"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { construirHref, getCompanyContext } from "@/lib/data/company"
import { leerFiltros, listAppointments } from "@/lib/data/records"
import { formatDate } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

/** Citas concertadas con clientes y en qué terminaron. */
export default async function AgendasPage({
  params,
  searchParams,
}: PageProps<"/e/[slug]/agendas">) {
  const { slug } = await params
  const sp = await searchParams
  const company = await getCompanyContext(slug)
  if (!company) notFound()
  if (!company.modules.includes("agendas")) {
    return <ModuleMissing companySlug={slug} companyName={company.name} />
  }

  const pagina = await listAppointments(company.id, leerFiltros(sp))

  // La fila solo la ve quien administra (RLS): para un asesor no hay botón.
  const supabase = await createClient()
  const { data: kommo } = company.canManage
    ? await supabase
        .from("kommo_integrations")
        .select("config")
        .eq("company_id", company.id)
        .maybeSingle()
    : { data: null }
  const modoKommo = (kommo?.config as { modo?: string } | null)?.modo
  const filtrando = Object.values(sp).some((v) => typeof v === "string" && v)

  return (
    <RecordsScaffold
      title="Agendas"
      description={`Citas de ${company.name} y su resultado. Se crean y se corrigen en Kommo.`}
      actions={
        modoKommo && <SincronizarKommo companyId={company.id} />
      }
      filters={<RecordFilters sedes={company.branches} responsables={company.staff} buscar="Nombre o celular…" />}
      total={pagina.total}
      page={pagina.page}
      pageSize={pagina.pageSize}
      hrefPagina={(p) => construirHref(`/e/${slug}/agendas`, sp, p)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Fecha</TableHead>
            <TableHead className="w-20">Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="w-36">Celular</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead className="w-32">Resultado</TableHead>
            <TableHead>Observación</TableHead>
            <TableHead className="w-32">Origen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="tabular-nums">{formatDate(a.scheduled_at)}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {a.scheduled_time?.slice(0, 5) ?? "—"}
              </TableCell>
              <TableCell className="max-w-56 truncate">
                {a.nombre ?? "—"}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {a.celular ?? "—"}
              </TableCell>
              <TableCell className="max-w-40 truncate text-sm">
                {a.responsable_nombre ?? "—"}
              </TableCell>
              <TableCell>
                {a.resultado ? (
                  <Badge
                    variant={a.resultado.toLowerCase() === "venta" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {a.resultado}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="max-w-72 truncate text-xs text-muted-foreground">
                {a.observacion ?? ""}
              </TableCell>
              <TableCell>
                <Origen fila={a} />
              </TableCell>
            </TableRow>
          ))}

          {pagina.rows.length === 0 && <EmptyRow colSpan={8} filtrando={filtrando} />}
        </TableBody>
      </Table>
    </RecordsScaffold>
  )
}

const ORIGENES: Record<string, string> = { kommo: "Kommo", excel: "Excel", app: "App" }

/** De dónde salió la agenda. Las de Kommo llevan su id y abren el lead allá. */
function Origen({
  fila,
}: {
  fila: { source: string; external_lead_id: number | null; external_url: string | null }
}) {
  const nombre = ORIGENES[fila.source] ?? fila.source
  if (fila.source !== "kommo" || !fila.external_url) {
    return (
      <Badge variant="secondary" className="text-[10px] font-normal">
        {nombre}
      </Badge>
    )
  }
  return (
    <a
      href={fila.external_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs tabular-nums hover:underline"
    >
      <Badge variant="outline" className="text-[10px] font-normal">
        {nombre}
      </Badge>
      #{fila.external_lead_id}
      <ExternalLink className="size-3" />
    </a>
  )
}
