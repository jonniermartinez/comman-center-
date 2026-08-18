import { ArrowRight } from "lucide-react"
import { notFound } from "next/navigation"

import { NuevaJornada, type JornadaExistente } from "@/components/captura/nueva-jornada"
import { ModuleMissing } from "@/components/module-missing"
import { RecordFilters } from "@/components/record-filters"
import { EmptyRow, RecordsScaffold } from "@/components/records-scaffold"
import { StatStrip } from "@/components/stat-strip"
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
import { leerFiltros, listActivity } from "@/lib/data/records"
import { formatDate, formatPercent } from "@/lib/format"

/**
 * Gestión diaria: una fila por persona y día.
 *
 * En el Excel esto era una sola hoja con la jornada, la cola del CRM en tres
 * momentos, las agendas, las llamadas y las atenciones. Antes la app lo partía
 * en dos formularios ("KPI Diario" y "Gestión Diaria") que en realidad eran
 * columnas de la misma fila.
 */
export default async function GestionDiariaPage({
  params,
  searchParams,
}: PageProps<"/e/[slug]/gestion-diaria">) {
  const { slug } = await params
  const sp = await searchParams
  const company = await getCompanyContext(slug)
  if (!company) notFound()
  if (!company.modules.includes("actividad_diaria")) {
    return <ModuleMissing companySlug={slug} companyName={company.name} />
  }

  const pagina = await listActivity(company.id, leerFiltros(sp))
  const tarde = pagina.rows.filter((r) => r.llego_tarde).length
  const conHora = pagina.rows.filter((r) => r.hora_llegada).length
  const filtrando = Object.values(sp).some((v) => typeof v === "string" && v)

  return (
    <RecordsScaffold
      title="Gestión Diaria"
      description={`Jornada, cola del CRM, agendas, llamadas y atenciones de ${company.name}. Se espera al equipo a las ${company.hora_entrada.slice(0, 5)}.`}
      actions={
        <NuevaJornada
          companyId={company.id}
          branches={company.branches}
          staff={company.staff}
          horaEntrada={company.hora_entrada}
          canManage={company.canManage}
          myStaffId={company.myStaffId}
        />
      }
      filters={<RecordFilters sedes={company.branches} responsables={company.staff} buscar="Responsable…" />}
      summary={
        <StatStrip
          className="mb-4"
          items={[
            { label: "Jornadas registradas", value: pagina.total, unit: "cantidad" },
            {
              label: "Llegadas tarde (página)",
              value: tarde,
              unit: "cantidad",
              hint: conHora ? `de ${conHora} con hora registrada` : "sin horas registradas",
            },
            {
              label: "Llamadas (página)",
              value: pagina.rows.reduce((a, r) => a + Number(r.total_llamadas ?? 0), 0),
              unit: "cantidad",
            },
            {
              label: "Ventas por llamada (página)",
              value: pagina.rows.reduce((a, r) => a + Number(r.llamada_efectiva ?? 0), 0),
              unit: "cantidad",
            },
          ]}
        />
      }
      total={pagina.total}
      page={pagina.page}
      pageSize={pagina.pageSize}
      hrefPagina={(p) => construirHref(`/e/${slug}/gestion-diaria`, sp, p)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Fecha</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead className="w-24">Llegada</TableHead>
            <TableHead className="text-right">Llamadas</TableHead>
            <TableHead className="text-right">Contest.</TableHead>
            <TableHead className="text-right">Ventas</TableHead>
            <TableHead className="text-right">Agendas</TableHead>
            <TableHead className="text-right">Atención</TableHead>
            <TableHead className="w-36 text-right">Cola del CRM</TableHead>
            <TableHead className="text-right">Contactab.</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="tabular-nums">{formatDate(r.report_date!)}</TableCell>
              <TableCell className="max-w-48 truncate text-sm">
                {r.responsable_nombre}
              </TableCell>
              <TableCell>
                {r.hora_llegada ? (
                  <Badge
                    variant={r.llego_tarde ? "destructive" : "outline"}
                    className="text-[10px] tabular-nums"
                  >
                    {r.hora_llegada.slice(0, 5)}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.total_llamadas}</TableCell>
              <TableCell className="text-right tabular-nums">{r.llamadas_contestadas}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {r.llamada_efectiva}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.total_agendas}</TableCell>
              <TableCell className="text-right tabular-nums">{r.total_atencion}</TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  {r.chats_inicial}
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span
                    className={
                      Number(r.chats_depurados) > 0 ? "font-semibold text-emerald-600" : ""
                    }
                  >
                    {r.chats_final}
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatPercent(r.ratio_contactabilidad === null ? null : Number(r.ratio_contactabilidad))}
              </TableCell>
              <TableCell>
                <NuevaJornada
                  companyId={company.id}
                  branches={company.branches}
                  staff={company.staff}
                  horaEntrada={company.hora_entrada}
                  canManage={company.canManage}
                  myStaffId={company.myStaffId}
                  registro={r as unknown as JornadaExistente}
                />
              </TableCell>
            </TableRow>
          ))}

          {pagina.rows.length === 0 && <EmptyRow colSpan={11} filtrando={filtrando} />}
        </TableBody>
      </Table>
    </RecordsScaffold>
  )
}
