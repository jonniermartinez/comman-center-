import { notFound } from "next/navigation"

import { NuevoMovimiento, type MovimientoExistente } from "@/components/captura/nuevo-movimiento"
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
import { construirHref, getCompanyContext, nombreDe } from "@/lib/data/company"
import { leerFiltros, listCashMovements } from "@/lib/data/records"
import { formatCOP, formatDate } from "@/lib/format"

/**
 * Movimientos de caja.
 *
 * Las salidas vienen del Excel con el monto en negativo. Se respeta el signo
 * —es lo que dice el archivo— y la columna `kind` es la que manda para sumar,
 * porque el signo depende de cómo lo haya digitado cada quien.
 */
export default async function CajaPage({ params, searchParams }: PageProps<"/e/[slug]/caja">) {
  const { slug } = await params
  const sp = await searchParams
  const company = await getCompanyContext(slug)
  if (!company) notFound()
  if (!company.modules.includes("caja")) {
    return <ModuleMissing companySlug={slug} companyName={company.name} />
  }

  const pagina = await listCashMovements(company.id, leerFiltros(sp))
  const entradas = pagina.rows
    .filter((m) => m.kind === "entrada")
    .reduce((a, m) => a + Math.abs(Number(m.amount)), 0)
  const salidas = pagina.rows
    .filter((m) => m.kind === "salida")
    .reduce((a, m) => a + Math.abs(Number(m.amount)), 0)
  const filtrando = Object.values(sp).some((v) => typeof v === "string" && v)

  return (
    <RecordsScaffold
      title="Ingreso y Gasto"
      description={`Entradas y salidas de caja de ${company.name}, por concepto y medio de pago.`}
      actions={
        company.canManage ? (
          <NuevoMovimiento
            companyId={company.id}
            branches={company.branches}
            staff={company.staff}
            conceptos={company.conceptosCaja}
            mediosPago={company.mediosPago}
          />
        ) : null
      }
      filters={<RecordFilters sedes={company.branches} responsables={company.staff} buscar="Nombre, factura u observación…" />}
      summary={
        <StatStrip
          className="mb-4"
          items={[
            { label: "Movimientos", value: pagina.total, unit: "cantidad" },
            { label: "Entradas (página)", value: entradas, unit: "moneda" },
            { label: "Salidas (página)", value: salidas, unit: "moneda" },
            { label: "Neto (página)", value: entradas - salidas, unit: "moneda" },
          ]}
        />
      }
      total={pagina.total}
      page={pagina.page}
      pageSize={pagina.pageSize}
      hrefPagina={(p) => construirHref(`/e/${slug}/caja`, sp, p)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Fecha</TableHead>
            <TableHead className="w-24">Tipo</TableHead>
            <TableHead className="w-32">Concepto</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead className="w-32">Medio</TableHead>
            <TableHead className="w-24">Factura</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="tabular-nums">{formatDate(m.report_date)}</TableCell>
              <TableCell>
                <Badge
                  variant={m.kind === "entrada" ? "default" : "destructive"}
                  className="text-[10px]"
                >
                  {m.kind === "entrada" ? "Entrada" : "Salida"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {nombreDe(company.conceptosCaja, m.concept_code)}
              </TableCell>
              <TableCell>
                <p className="max-w-56 truncate text-sm">{m.nombre ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.responsable_nombre ?? ""}
                </p>
              </TableCell>
              <TableCell className="text-sm">
                {nombreDe(company.mediosPago, m.method_code)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{m.factura ?? "—"}</TableCell>
              <TableCell
                className={
                  m.kind === "entrada"
                    ? "text-right font-medium tabular-nums text-emerald-600"
                    : "text-right font-medium tabular-nums text-destructive"
                }
              >
                {formatCOP(Math.abs(Number(m.amount)))}
              </TableCell>
              <TableCell>
                {company.canManage && (
                  <NuevoMovimiento
                    companyId={company.id}
                    branches={company.branches}
                    staff={company.staff}
                    conceptos={company.conceptosCaja}
                    mediosPago={company.mediosPago}
                    registro={m as unknown as MovimientoExistente}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}

          {pagina.rows.length === 0 && <EmptyRow colSpan={8} filtrando={filtrando} />}
        </TableBody>
      </Table>
    </RecordsScaffold>
  )
}
