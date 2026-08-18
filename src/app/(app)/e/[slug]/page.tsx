"use client"

import { AlertCircle, BarChart3, CheckCircle2, Circle, MapPin, Phone, Receipt, TrendingUp, Users } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useActiveCompany } from "@/components/company-guard"
import { PageHeader } from "@/components/page-header"
import { LegendDot, SectionCard, SectionCardHeader } from "@/components/section-card"
import { RatioBlock } from "@/components/stat-card"
import { StatStrip } from "@/components/stat-strip"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatCOP,
  formatCOPShort,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format"
import {
  RATIO_BLOCKS,
  branchMonthTotals,
  captureStatus,
  companyDayTotals,
  companyMonthTotals,
  computeRatios,
  dailySeries,
  isSameMonth,
  monthLabel,
  monthOf,
  safeRatio,
  sumKpi,
} from "@/lib/kpi"
import {
  useCompanyBranches,
  useCompanyMembers,
  useDb,
  useEffectiveToday,
} from "@/lib/store/hooks"

type Scope = "dia" | "mes"

export default function DashboardPage() {
  const company = useActiveCompany()
  const db = useDb()
  const today = useEffectiveToday()
  const branches = useCompanyBranches(company.id)

  const [scope, setScope] = useState<Scope>("dia")
  const [date, setDate] = useState(today)
  const [responsable, setResponsable] = useState<string>("todos")
  // "todas" = la empresa completa, que es la suma de sus sedes.
  const [sede, setSede] = useState<string>("todas")

  const branchId = sede === "todas" ? undefined : sede
  const members = useCompanyMembers(company.id, branchId)
  const month = monthOf(date)
  const modules = db.company_modules
    .filter((m) => m.company_id === company.id)
    .map((m) => m.module_code)

  // ----- KPI Diario -----
  const kpiRows = useMemo(
    () =>
      db.daily_kpi.filter(
        (k) =>
          k.company_id === company.id &&
          (!branchId || k.branch_id === branchId) &&
          (scope === "dia" ? k.report_date === date : isSameMonth(k.report_date, month)) &&
          (responsable === "todos" || k.user_id === responsable),
      ),
    [db.daily_kpi, company.id, branchId, scope, date, month, responsable],
  )
  const kpiTotals = useMemo(() => sumKpi(kpiRows), [kpiRows])
  const ratios = useMemo(() => computeRatios(kpiTotals), [kpiTotals])

  // ----- Ventas -----
  const totalsMes = companyMonthTotals(db, company.id, month, branchId)
  const totalsDia = companyDayTotals(db, company.id, date, branchId)
  const totals = scope === "dia" ? totalsDia : totalsMes

  const metaDe = (metric: string) =>
    db.objectives.find(
      (o) =>
        o.company_id === company.id &&
        o.period_month === month &&
        o.metric_code === metric &&
        !o.user_id,
    )?.target_value ?? null

  // ----- Ventas por financiación -----
  const porFinanciacion = useMemo(() => {
    const enabled = db.company_financing_types.filter(
      (f) => f.company_id === company.id && f.active,
    )
    return enabled
      .map((f) => {
        const meta = db.financing_types.find((x) => x.code === f.code)
        const rows = db.sales_entries.filter(
          (s) =>
            s.company_id === company.id &&
            (!branchId || s.branch_id === branchId) &&
            s.financing_code === f.code &&
            (scope === "dia" ? s.report_date === date : isSameMonth(s.report_date, month)),
        )
        const facturacion = db.billing_entries
          .filter(
            (b) =>
              b.company_id === company.id &&
              (!branchId || b.branch_id === branchId) &&
              b.code === f.code &&
              (scope === "dia" ? b.report_date === date : isSameMonth(b.report_date, month)),
          )
          .reduce((a, b) => a + b.amount, 0)
        return {
          code: f.code,
          name: meta?.name ?? f.code,
          sort: meta?.sort_order ?? 99,
          ventas: rows.filter((r) => r.kind === "venta").reduce((a, r) => a + r.ventas, 0),
          licencias: rows.filter((r) => r.kind === "venta").reduce((a, r) => a + r.licencias, 0),
          renovaciones: rows
            .filter((r) => r.kind === "renovacion")
            .reduce((a, r) => a + r.ventas, 0),
          facturacion,
        }
      })
      .sort((a, b) => a.sort - b.sort)
  }, [db, company.id, branchId, scope, date, month])

  // ----- Recaudo por medio de pago -----
  const porMedio = useMemo(() => {
    const enabled = db.company_payment_methods.filter(
      (p) => p.company_id === company.id && p.active,
    )
    return enabled
      .map((p) => {
        const meta = db.payment_methods.find((x) => x.code === p.code)
        const amount = db.collection_entries
          .filter(
            (c) =>
              c.company_id === company.id &&
              (!branchId || c.branch_id === branchId) &&
              c.code === p.code &&
              (scope === "dia" ? c.report_date === date : isSameMonth(c.report_date, month)),
          )
          .reduce((a, c) => a + c.amount, 0)
        return { code: p.code, name: meta?.name ?? p.code, sort: meta?.sort_order ?? 99, amount }
      })
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [db, company.id, branchId, scope, date, month])

  // ----- Serie diaria del mes -----
  const serie = useMemo(
    () => dailySeries(db, company.id, month, branchId),
    [db, company.id, month, branchId],
  )

  // ----- Ranking de responsables -----
  const ranking = useMemo(
    () =>
      members
        .map((m) => {
          const rows = db.daily_kpi.filter(
            (k) =>
              k.company_id === company.id &&
              k.user_id === m.id &&
              (scope === "dia" ? k.report_date === date : isSameMonth(k.report_date, month)),
          )
          const t = sumKpi(rows)
          const r = computeRatios(t)
          const meta = db.objectives.find(
            (o) =>
              o.company_id === company.id &&
              o.period_month === month &&
              o.metric_code === "ratio_contactabilidad" &&
              o.user_id === m.id,
          )?.target_value
          return { member: m, totals: t, ratios: r, metaContactabilidad: meta ?? null }
        })
        .sort((a, b) => b.totals.ventas_efectivas - a.totals.ventas_efectivas),
    [members, db, company.id, scope, date, month],
  )

  const capture = captureStatus(db, company.id, date, branchId)
  const desglosePorSede = useMemo(
    () => branchMonthTotals(db, company.id, month),
    [db, company.id, month],
  )

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          scope === "dia"
            ? `Cifras del ${formatDate(date)}. Las metas se comparan siempre contra el acumulado de ${monthLabel(month)}.`
            : `Acumulado de ${monthLabel(month)}. El reporte mensual es la suma de los diarios, no se digita.`
        }
        actions={
          <>
            <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <TabsList>
                <TabsTrigger value="dia">Día</TabsTrigger>
                <TabsTrigger value="mes">Mes</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <Label htmlFor="fecha" className="sr-only">
                Fecha
              </Label>
              <Input
                id="fecha"
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="w-40"
              />
            </div>
            {branches.length > 1 && (
              <Select value={sede} onValueChange={setSede}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las sedes</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={responsable} onValueChange={setResponsable}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los responsables</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* 1 · Cumplimiento del mes */}
      <StatStrip
        className="mb-6"
        items={[
          {
            label: "Ventas del mes",
            value: totalsMes.ventas,
            icon: TrendingUp,
            target: metaDe("ventas_mensuales"),
          },
          {
            label: "Licencias del mes",
            value: totalsMes.licencias,
            icon: Receipt,
            target: metaDe("licencias_mensuales"),
          },
          {
            label: "Facturación",
            value: totalsMes.facturacion,
            unit: "moneda",
            icon: BarChart3,
            target: metaDe("facturacion"),
          },
          {
            label: "Recaudo",
            value: totalsMes.recaudo,
            unit: "moneda",
            icon: BarChart3,
            target: metaDe("recaudo"),
          },
        ]}
      />

      {/* Desglose por sede: el total de la empresa es la suma de sus sedes */}
      {branches.length > 1 && sede === "todas" && (
        <SectionCard className="mb-6">
          <SectionCardHeader
            icon={MapPin}
            title="Por sede"
            description={`Acumulado de ${monthLabel(month)}`}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sede</TableHead>
                <TableHead className="text-right">Comerciales</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Licencias</TableHead>
                <TableHead className="text-right">Facturación</TableHead>
                <TableHead className="text-right">Contactabilidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {desglosePorSede.map((x) => (
                <TableRow key={x.branch.id}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => setSede(x.branch.id)}
                      className="underline-offset-2 hover:underline"
                    >
                      {x.branch.name}
                    </button>
                    {x.branch.is_primary && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        principal
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{x.comerciales}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.ventas.ventas}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.ventas.licencias}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOPShort(x.ventas.facturacion)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(x.ratios.ratio_contactabilidad)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total empresa</TableCell>
                <TableCell className="text-right tabular-nums">
                  {desglosePorSede.reduce((a, x) => a + x.comerciales, 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{totalsMes.ventas}</TableCell>
                <TableCell className="text-right tabular-nums">{totalsMes.licencias}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCOPShort(totalsMes.facturacion)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </SectionCard>
      )}

      {modules.includes("kpi_diario") && (
        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          {/* 2 · Embudo */}
          <SectionCard className="lg:col-span-2">
            <SectionCardHeader
              icon={Phone}
              title={`Embudo ${scope === "dia" ? "del día" : "del mes"}`}
            />
            <div>
              <FunnelChart
                data={[
                  { etapa: "Realizadas", valor: kpiTotals.llamadas_realizadas },
                  { etapa: "Contestadas", valor: kpiTotals.llamadas_contestadas },
                  { etapa: "Agendas", valor: kpiTotals.agendas_dia },
                  { etapa: "Atendidas", valor: kpiTotals.atencion_agendas },
                  { etapa: "Ventas", valor: kpiTotals.ventas_efectivas },
                ]}
              />
              <div className="mt-4 grid grid-cols-2 gap-x-6 border-t pt-2 sm:grid-cols-3">
                {RATIO_BLOCKS.map((b) => (
                  <div key={b.key} className="py-2">
                    <p className="text-xs text-muted-foreground">{b.label}</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatPercent(ratios[b.key])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Detalle tipo Excel */}
          <SectionCard>
            <SectionCardHeader icon={BarChart3} title="Detalle KPI" />
            <div>
              {RATIO_BLOCKS.map((b) => (
                <RatioBlock
                  key={b.key}
                  label={b.label}
                  numeradorLabel={numLabel(b.numerador)}
                  numerador={kpiTotals[b.numerador]}
                  denominadorLabel={numLabel(b.denominador)}
                  denominador={kpiTotals[b.denominador]}
                  ratio={ratios[b.key]}
                />
              ))}
            </div>
          </SectionCard>
        </section>
      )}

      {modules.includes("reporte_ventas") && (
        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          {/* 3 · Ventas por financiación */}
          <SectionCard>
            <SectionCardHeader
              icon={Receipt}
              title="Ventas por financiación"
              actions={
                <>
                  <LegendDot color="var(--chart-1)" label="Ventas" />
                  <LegendDot color="var(--chart-2)" label="Licencias" />
                </>
              }
            />
            <div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porFinanciacion} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} dy={8} height={44} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ChartTooltip content={<Tip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ventas" name="Ventas" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="licencias" name="Licencias" fill="var(--chart-2)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Financiación</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Licencias</TableHead>
                    <TableHead className="text-right">Facturación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porFinanciacion.map((f) => (
                    <TableRow key={f.code}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.ventas}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.licencias}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCOPShort(f.facturacion)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{totals.ventas}</TableCell>
                    <TableCell className="text-right tabular-nums">{totals.licencias}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOPShort(totals.facturacion)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          {/* 4 · Facturación y recaudo del mes */}
          <SectionCard>
            <SectionCardHeader
              icon={BarChart3}
              title="Facturación y recaudo"
              description={monthLabel(month)}
              actions={
                <>
                  <LegendDot color="var(--chart-1)" label="Facturación" />
                  <LegendDot color="var(--chart-3)" label="Recaudo" />
                </>
              }
            />
            <div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={serie} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `${Math.round(v / 1_000_000)}M`}
                  />
                  <ChartTooltip content={<Tip money />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="facturacion"
                    name="Facturación"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="recaudo"
                    name="Recaudo"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-3 space-y-1.5 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Recaudo por medio de pago
                </p>
                {porMedio.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin recaudo registrado.</p>
                ) : (
                  porMedio.map((m) => (
                    <div key={m.code} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{m.name}</span>
                      <span className="tabular-nums">{formatCOP(m.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
                  <span>Total recaudo</span>
                  <span className="tabular-nums">{formatCOP(totals.recaudo)}</span>
                </div>
              </div>
            </div>
          </SectionCard>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        {/* 5 · Ranking */}
        <SectionCard className="lg:col-span-2">
          <SectionCardHeader
            icon={Users}
            title="Comerciales"
            description={sede === "todas" ? "Todas las sedes" : undefined}
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="text-right">Llamadas</TableHead>
                  <TableHead className="text-right">Contestadas</TableHead>
                  <TableHead className="text-right">Contactabilidad</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Conversión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map(({ member, totals: t, ratios: r, metaContactabilidad }) => {
                  const cumple =
                    metaContactabilidad !== null && r.ratio_contactabilidad !== null
                      ? r.ratio_contactabilidad * 100 >= metaContactabilidad
                      : null
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.full_name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {member.branchName ?? "toda la empresa"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(t.llamadas_realizadas)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(t.llamadas_contestadas)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={
                            cumple === null
                              ? undefined
                              : cumple
                                ? "text-emerald-600"
                                : "text-rose-600"
                          }
                        >
                          {formatPercent(r.ratio_contactabilidad)}
                        </span>
                        {metaContactabilidad !== null && (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            / {metaContactabilidad}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(t.ventas_efectivas)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPercent(r.ratio_conversion_llamada, 1)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {ranking.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Sin usuarios asignados a esta empresa.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        {/* 6 · Estado de captura */}
        <SectionCard>
          <SectionCardHeader icon={Circle} title={`Captura del ${formatDate(date)}`} />
          <div className="space-y-2">
            {capture.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin usuarios asignados.</p>
            )}
            {capture.map((c) => (
              <div key={c.user_id} className="flex items-center gap-2 text-sm">
                {c.kpi && (!modules.includes("gestion_diaria") || c.gestion) ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                ) : c.kpi || c.gestion ? (
                  <AlertCircle className="size-4 shrink-0 text-amber-600" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{c.full_name}</span>
                <div className="flex gap-1">
                  {modules.includes("kpi_diario") && (
                    <Badge variant={c.kpi ? "default" : "outline"} className="text-[10px]">
                      KPI
                    </Badge>
                  )}
                  {modules.includes("gestion_diaria") && (
                    <Badge variant={c.gestion ? "default" : "outline"} className="text-[10px]">
                      Gestión
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </>
  )
}

function numLabel(key: string) {
  const labels: Record<string, string> = {
    llamadas_realizadas: "Llamadas realizadas",
    llamadas_contestadas: "Llamadas contestadas",
    ventas_efectivas: "Ventas efectivas",
    agendas_dia: "Agendas del día",
    atencion_agendas: "Atención agendas",
    clientes_atendidos: "Total clientes atendidos",
    ventas_exitosas: "Ventas exitosas",
    llamada_agenda: "Llamada agenda",
  }
  return labels[key] ?? key
}

/**
 * Embudo horizontal. Las etapas son magnitud ordenada, no identidades: van todas
 * en un solo hue con etiqueta directa, en vez de cinco colores categóricos.
 * A la derecha, la caída respecto a la etapa anterior.
 */
function FunnelChart({ data }: { data: { etapa: string; valor: number }[] }) {
  const max = Math.max(...data.map((d) => d.valor), 1)

  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const prev = i > 0 ? data[i - 1].valor : null
        const caida = prev !== null ? safeRatio(d.valor, prev) : null
        return (
          <div key={d.etapa} className="grid grid-cols-[7rem_1fr_5rem] items-center gap-2">
            <span className="truncate text-xs text-muted-foreground">{d.etapa}</span>
            <div className="h-6 w-full bg-muted">
              <div
                className="h-full rounded-r-sm transition-all"
                style={{
                  width: `${(d.valor / max) * 100}%`,
                  backgroundColor: "var(--chart-1)",
                }}
              />
            </div>
            <span className="text-right text-xs tabular-nums">
              {formatNumber(d.valor)}
              {caida !== null && (
                <span className="ml-1 text-muted-foreground">{formatPercent(caida)}</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface TipPayload {
  name?: string
  value?: number
  color?: string
}

function Tip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean
  payload?: TipPayload[]
  label?: string | number
  money?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="border bg-popover px-2.5 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{money ? `Día ${label}` : label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 tabular-nums">
          <span className="size-2" style={{ backgroundColor: p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto">
            {money ? formatCOP(p.value ?? 0) : formatNumber(p.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  )
}
