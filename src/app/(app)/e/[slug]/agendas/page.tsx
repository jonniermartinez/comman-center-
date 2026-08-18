import { notFound } from "next/navigation"

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
  const filtrando = Object.values(sp).some((v) => typeof v === "string" && v)

  return (
    <RecordsScaffold
      title="Agendas"
      description={`Citas concertadas por ${company.name} y su resultado.`}
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="tabular-nums">{formatDate(a.scheduled_at)}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {a.scheduled_time?.slice(0, 5) ?? "—"}
              </TableCell>
              <TableCell className="max-w-56 truncate">{a.nombre ?? "—"}</TableCell>
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
            </TableRow>
          ))}

          {pagina.rows.length === 0 && <EmptyRow colSpan={7} filtrando={filtrando} />}
        </TableBody>
      </Table>
    </RecordsScaffold>
  )
}
