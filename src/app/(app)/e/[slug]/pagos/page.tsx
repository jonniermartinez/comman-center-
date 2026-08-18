import { notFound } from "next/navigation"

import { NuevoPago, type PagoExistente } from "@/components/captura/nuevo-pago"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { construirHref, getCompanyContext } from "@/lib/data/company"
import { leerFiltros, listPayments } from "@/lib/data/records"
import { formatCOP, formatDate } from "@/lib/format"

/** Abonos recibidos contra cada crédito, como la hoja "Pagos" del Excel. */
export default async function PagosPage({ params, searchParams }: PageProps<"/e/[slug]/pagos">) {
  const { slug } = await params
  const sp = await searchParams
  const company = await getCompanyContext(slug)
  if (!company) notFound()
  if (!company.modules.includes("pagos")) {
    return <ModuleMissing companySlug={slug} companyName={company.name} />
  }

  const filtros = leerFiltros(sp)
  const pagina = await listPayments(company.id, filtros)
  const totalPagina = pagina.rows.reduce((a, p) => a + Number(p.amount), 0)
  const sede = (id: string) => company.branches.find((b) => b.id === id)?.name ?? "—"
  const filtrando = Object.values(sp).some((v) => typeof v === "string" && v)

  return (
    <RecordsScaffold
      title="Pagos"
      description={`Abonos recibidos por ${company.name}, con su medio de pago y el crédito al que pertenecen.`}
      actions={
        <NuevoPago
          companyId={company.id}
          branches={company.branches}
          mediosPago={company.mediosPago}
        />
      }
      filters={
        <RecordFilters sedes={company.branches} buscar="Nombre, documento o referencia…" />
      }
      summary={
        <StatStrip
          className="mb-4"
          items={[
            { label: "Pagos en el filtro", value: pagina.total, unit: "cantidad" },
            {
              label: "Suma de esta página",
              value: totalPagina,
              unit: "moneda",
              hint: `${pagina.rows.length} de ${pagina.total.toLocaleString("es-CO")}`,
            },
          ]}
        />
      }
      total={pagina.total}
      page={pagina.page}
      pageSize={pagina.pageSize}
      hrefPagina={(p) => construirHref(`/e/${slug}/pagos`, sp, p)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Fecha</TableHead>
            <TableHead>Titular</TableHead>
            <TableHead>Referencia</TableHead>
            <TableHead className="w-32">Medio de pago</TableHead>
            <TableHead className="w-24">Recibo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="tabular-nums">
                <span className="flex items-center gap-1.5">
                  {formatDate(p.report_date)}
                  {p.date_estimated && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-[10px]">
                          aprox.
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        El archivo no traía fecha para este pago. Se tomó la de su venta: el monto
                        es real, el día es aproximado.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">{sede(p.branch_id)}</span>
              </TableCell>
              <TableCell>
                <p className="max-w-56 truncate text-sm">{p.titular_nombre ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{p.titular_id ?? ""}</p>
              </TableCell>
              <TableCell className="max-w-52 truncate text-xs text-muted-foreground">
                {p.ref_credito ?? "—"}
                {!p.sale_id && (
                  <Badge variant="outline" className="ml-1.5 text-[10px]">
                    sin venta
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-xs">{p.method_code ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{p.recibo ?? "—"}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatCOP(Number(p.amount))}
              </TableCell>
              <TableCell>
                <NuevoPago
                  companyId={company.id}
                  branches={company.branches}
                  mediosPago={company.mediosPago}
                  registro={p as unknown as PagoExistente}
                />
              </TableCell>
            </TableRow>
          ))}

          {pagina.rows.length === 0 && <EmptyRow colSpan={7} filtrando={filtrando} />}
        </TableBody>
      </Table>
    </RecordsScaffold>
  )
}
