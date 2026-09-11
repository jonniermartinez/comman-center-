import { notFound } from "next/navigation"

import { NuevaVenta, type VentaExistente } from "@/components/captura/nueva-venta"
import { AlertaSeguimiento } from "@/components/ventas/alerta-seguimiento"
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
import { leerFiltros, listSales, totalesVentas, ventasPorRecontactar } from "@/lib/data/records"
import { formatCOP, formatDate, todayISO } from "@/lib/format"

/**
 * Ventas: una fila por crédito, como la hoja "Base" del Excel.
 *
 * Es el módulo con más columnas del sistema, así que la tabla muestra lo que se
 * mira de un vistazo —cliente, producto, valores y saldo— y el resto queda en
 * el detalle de cada fila.
 */
export default async function VentasPage({ params, searchParams }: PageProps<"/e/[slug]/ventas">) {
  const { slug } = await params
  const sp = await searchParams
  const company = await getCompanyContext(slug)
  if (!company) notFound()
  if (!company.modules.includes("ventas")) {
    return <ModuleMissing companySlug={slug} companyName={company.name} />
  }

  const filtros = leerFiltros(sp)
  // Cuántas ventas piden recontacto: se cuenta sobre todo lo que alcanza el
  // filtro, no sobre la página que se está viendo.
  const hoy = todayISO()
  const [pagina, totales, porRecontactar] = await Promise.all([
    listSales(company.id, filtros),
    totalesVentas(company.id, filtros),
    ventasPorRecontactar(company.id, filtros, hoy),
  ])

  const sede = (id: string) => company.branches.find((b) => b.id === id)?.name ?? "—"
  const nombreDeProducto = (id: string | null) =>
    id ? (company.productosEmpresa.find((p) => p.id === id)?.name ?? null) : null
  const filtrando = Object.values(sp).some((v) => typeof v === "string" && v)

  return (
    <RecordsScaffold
      title="Ventas"
      description={`Créditos vendidos por ${company.name}. Cada fila es una licencia financiada, con su cliente, su valor y su saldo.`}
      actions={
        <NuevaVenta
          companyId={company.id}
          branches={company.branches}
          staff={company.staff}
          financiaciones={company.financiaciones}
          productosEmpresa={company.productosEmpresa}
          traficos={company.traficos}
          escuelas={company.escuelas}
          estados={company.estados}
          canManage={company.canManage}
          isSuperAdmin={company.isSuperAdmin}
          myStaffId={company.myStaffId}
        />
      }
      filters={
        <RecordFilters
          sedes={company.branches}
          responsables={company.staff}
          buscar="Nombre o documento del cliente…"
        />
      }
      summary={
        <StatStrip
          className="mb-4"
          items={[
            { label: "Ventas", value: pagina.total, unit: "cantidad" },
            { label: "Licencias", value: Math.round(totales.licencias), unit: "cantidad" },
            { label: "Facturación", value: totales.facturacion, unit: "moneda" },
            { label: "Recaudado", value: totales.recaudo, unit: "moneda" },
            { label: "Saldo", value: totales.saldo, unit: "moneda" },
            {
              label: "Por recontactar",
              value: porRecontactar,
              unit: "cantidad",
              hint: "Sin certificar a los 85 días",
            },
          ]}
        />
      }
      total={pagina.total}
      page={pagina.page}
      pageSize={pagina.pageSize}
      hrefPagina={(p) => construirHref(`/e/${slug}/ventas`, sp, p)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="w-24">Producto</TableHead>
            <TableHead className="w-28">Financiación</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead className="w-28">Estado</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Recaudo</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.rows.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="tabular-nums">{formatDate(v.report_date)}</TableCell>
              <TableCell>
                <p className="max-w-56 truncate text-sm">{v.licencia_nombre ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {v.licencia_id ?? ""} · {sede(v.branch_id)}
                </p>
              </TableCell>
              <TableCell className="text-sm">
                {nombreDeProducto(v.company_product_id) ??
                  nombreDe(company.productos, v.product_code)}
              </TableCell>
              <TableCell className="text-sm">
                {nombreDe(company.financiaciones, v.financing_code)}
              </TableCell>
              <TableCell className="max-w-40 truncate text-sm">
                {v.responsable_nombre ?? "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={v.state_code === "certificado" ? "default" : "outline"}
                    className="text-[10px] whitespace-nowrap"
                  >
                    {nombreDe(company.estados, v.state_code)}
                  </Badge>
                  <AlertaSeguimiento
                    fecha={v.report_date}
                    estado={v.state_code}
                    estadoNombre={nombreDe(company.estados, v.state_code)}
                    hoy={hoy}
                    cliente={v.licencia_nombre ?? "El cliente"}
                  />
                </div>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatCOP(Number(v.valor_final))}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatCOP(Number(v.recaudo))}
              </TableCell>
              <TableCell
                className={
                  Number(v.saldo) > 0
                    ? "text-right font-medium tabular-nums text-amber-600"
                    : "text-right tabular-nums text-muted-foreground"
                }
              >
                {formatCOP(Number(v.saldo))}
              </TableCell>
              <TableCell>
                {/* Una venta guardada solo la corrige el super admin (039): a
                    los demás no se les ofrece un lápiz que la base va a
                    rechazar. */}
                {company.isSuperAdmin && (
                  <NuevaVenta
                    companyId={company.id}
                    branches={company.branches}
                    staff={company.staff}
                    financiaciones={company.financiaciones}
                    productosEmpresa={company.productosEmpresa}
                    traficos={company.traficos}
                    escuelas={company.escuelas}
                    estados={company.estados}
                    canManage={company.canManage}
                    isSuperAdmin={company.isSuperAdmin}
                    myStaffId={company.myStaffId}
                    registro={v as unknown as VentaExistente}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}

          {pagina.rows.length === 0 && <EmptyRow colSpan={10} filtrando={filtrando} />}
        </TableBody>
      </Table>
    </RecordsScaffold>
  )
}
