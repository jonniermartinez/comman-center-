import { notFound } from "next/navigation"
import { AlertCircle, CheckCircle2, Clock } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { SectionCard, SectionCardHeader } from "@/components/section-card"
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
import { getCompanyContext } from "@/lib/data/company"
import { loadDashboard } from "@/lib/data/dashboard"
import { formatCOP, formatCOPShort, formatNumber, formatPercent, todayISO } from "@/lib/format"
import { monthLabel, monthOf } from "@/lib/kpi"

/**
 * Dashboard de la empresa.
 *
 * Todo lo que se ve acá lo calcula Postgres en las vistas de la migración 014.
 * Es a propósito: son 16.000 ventas y 19.000 pagos, y además el mismo número
 * tiene que salir igual en el dashboard, en los reportes y en los objetivos.
 */
export default async function DashboardPage({
  params,
  searchParams,
}: PageProps<"/e/[slug]">) {
  const { slug } = await params
  const sp = await searchParams
  const company = await getCompanyContext(slug)
  if (!company) notFound()

  const hoy = todayISO()
  const mes = typeof sp.mes === "string" ? `${sp.mes}-01` : monthOf(hoy)
  const datos = await loadDashboard(company.id, mes)

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={company.name}
        description={`Resultados de ${monthLabel(mes)}. Todo sale de las ventas y los pagos registrados: nada se digita aparte.`}
      />

      <StatStrip
        className="mb-6"
        items={[
          { label: "Ventas del mes", value: datos.totales.ventas, unit: "cantidad" },
          { label: "Licencias", value: datos.totales.licencias, unit: "cantidad" },
          { label: "Renovaciones", value: datos.totales.renovaciones, unit: "cantidad" },
          { label: "Facturación", value: datos.totales.facturacion, unit: "moneda" },
          { label: "Recaudo", value: datos.totales.recaudo, unit: "moneda" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <SectionCardHeader
            title="Ventas por financiación"
            description={`Cómo se financió lo vendido en ${monthLabel(mes)}.`}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Financiación</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Licencias</TableHead>
                <TableHead className="text-right">Facturación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.porFinanciacion.map((f) => (
                <TableRow key={f.financing_code ?? "sin"}>
                  <TableCell className="text-sm">{f.financing_name ?? "Sin financiación"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{f.ventas}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.licencias}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOPShort(f.facturacion)}
                  </TableCell>
                </TableRow>
              ))}
              {datos.porFinanciacion.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    Sin ventas registradas en el mes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader
            title="Recaudo por medio de pago"
            description="Lo que efectivamente entró, no lo facturado."
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medio de pago</TableHead>
                <TableHead className="text-right">Pagos</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.porMedioPago.map((m) => (
                <TableRow key={m.method_code ?? "sin"}>
                  <TableCell className="text-sm">{m.method_code ?? "Sin medio"}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.pagos}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCOP(m.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {datos.porMedioPago.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                    Sin pagos registrados en el mes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      {company.branches.length > 1 && (
        <SectionCard className="mt-4">
          <SectionCardHeader
            title="Por sede"
            description="El total de la empresa es la suma de sus sedes."
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sede</TableHead>
                <TableHead className="text-right">Comerciales</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Facturación</TableHead>
                <TableHead className="text-right">Recaudo</TableHead>
                <TableHead className="text-right">Contactabilidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.porSede.map((s) => (
                <TableRow key={s.branch_id}>
                  <TableCell className="text-sm font-medium">{s.branch_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.comerciales}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.ventas_mes}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOPShort(s.facturacion_mes)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOPShort(s.recaudo_mes)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatPercent(s.ratio_contactabilidad)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      <SectionCard className="mt-4">
        <SectionCardHeader
          title="Ranking de comerciales"
          description={`Actividad y ventas de ${monthLabel(mes)}. La contactabilidad se recalcula sobre los totales del mes, no se promedian los días.`}
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comercial</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead className="text-right">Tarde</TableHead>
                <TableHead className="text-right">Llamadas</TableHead>
                <TableHead className="text-right">Contest.</TableHead>
                <TableHead className="text-right">Ventas x llamada</TableHead>
                <TableHead className="text-right">Atenciones</TableHead>
                <TableHead className="text-right">Contactab.</TableHead>
                <TableHead className="text-right">Conversión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.ranking.map((r) => (
                <TableRow key={r.staff_id}>
                  <TableCell className="max-w-52 truncate text-sm">
                    {r.responsable_nombre}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.dias_reportados}</TableCell>
                  <TableCell className="text-right">
                    {r.dias_tarde > 0 ? (
                      <Badge variant="destructive" className="gap-1 text-[10px] tabular-nums">
                        <Clock className="size-3" />
                        {r.dias_tarde}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.total_llamadas}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.llamadas_contestadas}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {r.llamada_efectiva}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.total_atencion}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatPercent(r.ratio_contactabilidad)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatPercent(r.ratio_conversion_llamada)}
                  </TableCell>
                </TableRow>
              ))}
              {datos.ranking.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                    Sin gestión diaria registrada en el mes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard className="mt-4">
        <SectionCardHeader
          title="Registro de hoy"
          description={`Quién ya registró su jornada del ${hoy.slice(8, 10)}/${hoy.slice(5, 7)}.`}
        />
        <div className="flex flex-wrap gap-2">
          {datos.capturaHoy.map((c) => (
            <Badge
              key={c.staff_id}
              variant={c.registrado ? "secondary" : "outline"}
              className="gap-1"
            >
              {c.registrado ? (
                <CheckCircle2 className="size-3 text-emerald-600" />
              ) : (
                <AlertCircle className="size-3 text-amber-600" />
              )}
              {c.responsable_nombre}
            </Badge>
          ))}
          {datos.capturaHoy.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {company.name} todavía no tiene comerciales en el equipo.
            </p>
          )}
        </div>
      </SectionCard>

      <p className="mt-4 text-xs text-muted-foreground">
        {formatNumber(datos.totales.ventas)} venta(s) y {formatCOP(datos.totales.recaudo)} de
        recaudo en {monthLabel(mes)}.
      </p>
    </div>
  )
}
