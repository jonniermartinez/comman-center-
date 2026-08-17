"use client"

import { Check, Info, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ModuleGuard, useActiveCompany } from "@/components/company-guard"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCOP, formatDate, formatNumber } from "@/lib/format"
import { companyMonthTotals, isSameMonth, monthLabel, monthOf } from "@/lib/kpi"
import { saveSalesReport } from "@/lib/store/actions"
import {
  useCanManage,
  useCompanyBranches,
  useCompanyCatalog,
  useDb,
  useEffectiveToday,
  useMyBranch,
} from "@/lib/store/hooks"

type NumMap = Record<string, number>
type VentaMap = Record<string, { ventas: number; licencias: number }>

export default function ReporteVentasPage() {
  return (
    <ModuleGuard module="reporte_ventas">
      <ReporteVentasForm />
    </ModuleGuard>
  )
}

function ReporteVentasForm() {
  const company = useActiveCompany()
  const db = useDb()
  const today = useEffectiveToday()
  const canManage = useCanManage(company.id)
  const branches = useCompanyBranches(company.id)
  const myBranch = useMyBranch(company.id)
  const financiaciones = useCompanyCatalog(company.id, "financing")
  const medios = useCompanyCatalog(company.id, "payment")

  const [date, setDate] = useState(today)
  // Las ventas se reportan por sede. Se abre en la sede del usuario, o en la
  // principal si supervisa toda la empresa.
  const [branchId, setBranchId] = useState(
    myBranch ?? branches.find((b) => b.is_primary)?.id ?? branches[0]?.id ?? "",
  )
  const [ventas, setVentas] = useState<VentaMap>({})
  const [renovaciones, setRenovaciones] = useState<NumMap>({})
  const [facturacion, setFacturacion] = useState<NumMap>({})
  const [recaudo, setRecaudo] = useState<NumMap>({})

  const month = monthOf(date)

  // Registros existentes del día. Guardar reemplaza el día completo.
  const existentes = useMemo(() => {
    const delDia = (r: { company_id: string; branch_id: string; report_date: string }) =>
      r.company_id === company.id && r.branch_id === branchId && r.report_date === date
    const sales = db.sales_entries.filter(delDia)
    const bills = db.billing_entries.filter(delDia)
    const colls = db.collection_entries.filter(delDia)
    return { sales, bills, colls, hay: sales.length + bills.length + colls.length > 0 }
  }, [db, company.id, branchId, date])

  // Carga del día existente al cambiar de fecha. Se ajusta en render, no en un
  // efecto, para no pintar un frame con los datos del día anterior.
  const slotKey = `${branchId}|${date}`
  const [loadedSlot, setLoadedSlot] = useState<string | null>(null)
  if (loadedSlot !== slotKey) {
    setLoadedSlot(slotKey)
    const v: VentaMap = {}
    const r: NumMap = {}
    for (const s of existentes.sales) {
      if (s.kind === "venta") {
        v[s.financing_code] = {
          ventas: (v[s.financing_code]?.ventas ?? 0) + s.ventas,
          licencias: (v[s.financing_code]?.licencias ?? 0) + s.licencias,
        }
      } else {
        r[s.financing_code] = (r[s.financing_code] ?? 0) + s.ventas
      }
    }
    setVentas(v)
    setRenovaciones(r)
    setFacturacion(Object.fromEntries(existentes.bills.map((b) => [b.code, b.amount])))
    setRecaudo(Object.fromEntries(existentes.colls.map((c) => [c.code, c.amount])))
  }

  const totalVentas = Object.values(ventas).reduce((a, v) => a + (v.ventas || 0), 0)
  const totalLicencias = Object.values(ventas).reduce((a, v) => a + (v.licencias || 0), 0)
  const totalRenovaciones = Object.values(renovaciones).reduce((a, v) => a + (v || 0), 0)
  const totalFacturacion = Object.values(facturacion).reduce((a, v) => a + (v || 0), 0)
  const totalRecaudo = Object.values(recaudo).reduce((a, v) => a + (v || 0), 0)

  // El mensual no se digita: es la suma de los diarios ya guardados.
  // Acumulado de la empresa completa: la suma de todas sus sedes.
  const mensual = companyMonthTotals(db, company.id, month)
  const diasReportados = new Set(
    db.sales_entries
      .filter((s) => s.company_id === company.id && isSameMonth(s.report_date, month))
      .map((s) => s.report_date),
  ).size

  const fechaFutura = date > today

  function submit() {
    if (fechaFutura || !canManage || !branchId) return
    saveSalesReport({
      company_id: company.id,
      branch_id: branchId,
      report_date: date,
      ventas,
      renovaciones,
      facturacion,
      recaudo,
    })
    const sede = branches.find((b) => b.id === branchId)
    toast.success("Reporte del día guardado", {
      description: `${sede?.name} · ${formatDate(date)} · ${totalVentas} venta(s), ${totalLicencias} licencia(s), ${formatCOP(totalFacturacion)} facturado.`,
    })
  }

  if (!canManage) {
    return (
      <Alert>
        <Info />
        <AlertDescription>
          El reporte de ventas se registra a nivel de empresa, así que lo diligencia un coordinador
          o el super admin. Puedes ver los totales en el dashboard.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Reporte de Ventas"
        description="Reemplaza el Reporte Diario del Excel. El reporte mensual no se digita: es la suma de los diarios."
        actions={
          existentes.hay && (
            <Badge variant="secondary" className="gap-1">
              <Check className="size-3" />
              Día ya reportado — editando
            </Badge>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha reporte</Label>
            <Input
              id="fecha"
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-44"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sede">Sede</Label>
            <Select
              value={branchId}
              onValueChange={setBranchId}
              disabled={branches.length <= 1 || !!myBranch}
            >
              <SelectTrigger id="sede" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {b.is_primary ? " · principal" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Ventas del día</p>
              <p className="text-lg font-semibold tabular-nums">{totalVentas}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Licencias del día</p>
              <p className="text-lg font-semibold tabular-nums">{totalLicencias}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Facturación</p>
              <p className="text-lg font-semibold tabular-nums">{formatCOP(totalFacturacion)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recaudo</p>
              <p className="text-lg font-semibold tabular-nums">{formatCOP(totalRecaudo)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ventas">
        <TabsList>
          <TabsTrigger value="ventas">Ventas y licencias</TabsTrigger>
          <TabsTrigger value="renovaciones">Renovaciones</TabsTrigger>
          <TabsTrigger value="facturacion">Facturación</TabsTrigger>
          <TabsTrigger value="recaudo">Recaudo</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ventas y licencias por financiación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-[1fr_6rem_6rem] items-center gap-3 border-b pb-2 text-xs font-medium text-muted-foreground">
                <span>Financiación</span>
                <span className="text-right">Ventas</span>
                <span className="text-right">Licencias</span>
              </div>
              {financiaciones.map((f) => (
                <div
                  key={f.code}
                  className="grid grid-cols-[1fr_6rem_6rem] items-center gap-3 border-b py-2"
                >
                  <Label htmlFor={`v-${f.code}`} className="text-sm font-normal">
                    {f.name}
                  </Label>
                  <Input
                    id={`v-${f.code}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={ventas[f.code]?.ventas ?? 0}
                    onChange={(e) =>
                      setVentas((prev) => ({
                        ...prev,
                        [f.code]: {
                          ventas: Math.max(0, Number(e.target.value) || 0),
                          licencias: prev[f.code]?.licencias ?? 0,
                        },
                      }))
                    }
                    className="text-right tabular-nums"
                  />
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    aria-label={`Licencias ${f.name}`}
                    value={ventas[f.code]?.licencias ?? 0}
                    onChange={(e) =>
                      setVentas((prev) => ({
                        ...prev,
                        [f.code]: {
                          ventas: prev[f.code]?.ventas ?? 0,
                          licencias: Math.max(0, Number(e.target.value) || 0),
                        },
                      }))
                    }
                    className="text-right tabular-nums"
                  />
                </div>
              ))}
              <div className="grid grid-cols-[1fr_6rem_6rem] items-center gap-3 pt-3 text-sm font-semibold">
                <span>Total del día</span>
                <span className="pr-3 text-right tabular-nums">{totalVentas}</span>
                <span className="pr-3 text-right tabular-nums">{totalLicencias}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renovaciones">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Renovaciones por financiación</CardTitle>
            </CardHeader>
            <CardContent>
              {financiaciones.map((f) => (
                <div
                  key={f.code}
                  className="grid grid-cols-[1fr_6rem] items-center gap-3 border-b py-2"
                >
                  <Label htmlFor={`r-${f.code}`} className="text-sm font-normal">
                    {f.name}
                  </Label>
                  <Input
                    id={`r-${f.code}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={renovaciones[f.code] ?? 0}
                    onChange={(e) =>
                      setRenovaciones((prev) => ({
                        ...prev,
                        [f.code]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="text-right tabular-nums"
                  />
                </div>
              ))}
              <div className="grid grid-cols-[1fr_6rem] items-center gap-3 pt-3 text-sm font-semibold">
                <span>Total renovaciones</span>
                <span className="pr-3 text-right tabular-nums">{totalRenovaciones}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facturacion">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Facturación por financiación</CardTitle>
            </CardHeader>
            <CardContent>
              {financiaciones.map((f) => (
                <div
                  key={f.code}
                  className="grid grid-cols-[1fr_10rem] items-center gap-3 border-b py-2"
                >
                  <Label htmlFor={`f-${f.code}`} className="text-sm font-normal">
                    {f.name}
                  </Label>
                  <Input
                    id={`f-${f.code}`}
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    value={facturacion[f.code] ?? 0}
                    onChange={(e) =>
                      setFacturacion((prev) => ({
                        ...prev,
                        [f.code]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="text-right tabular-nums"
                  />
                </div>
              ))}
              <div className="grid grid-cols-[1fr_10rem] items-center gap-3 pt-3 text-sm font-semibold">
                <span>Total facturación</span>
                <span className="pr-3 text-right tabular-nums">{formatCOP(totalFacturacion)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recaudo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recaudo por medio de pago</CardTitle>
            </CardHeader>
            <CardContent>
              {medios.map((m) => (
                <div
                  key={m.code}
                  className="grid grid-cols-[1fr_10rem] items-center gap-3 border-b py-2"
                >
                  <Label htmlFor={`rc-${m.code}`} className="text-sm font-normal">
                    {m.name}
                  </Label>
                  <Input
                    id={`rc-${m.code}`}
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    value={recaudo[m.code] ?? 0}
                    onChange={(e) =>
                      setRecaudo((prev) => ({
                        ...prev,
                        [m.code]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="text-right tabular-nums"
                  />
                </div>
              ))}
              <div className="grid grid-cols-[1fr_10rem] items-center gap-3 pt-3 text-sm font-semibold">
                <span>Total recaudo</span>
                <span className="pr-3 text-right tabular-nums">{formatCOP(totalRecaudo)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Acumulado del mes: calculado, no digitable */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            Acumulado de {monthLabel(month)} · calculado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: "Ventas", value: formatNumber(mensual.ventas) },
              { label: "Licencias", value: formatNumber(mensual.licencias) },
              { label: "Renovaciones", value: formatNumber(mensual.renovaciones) },
              { label: "Facturación", value: formatCOP(mensual.facturacion) },
              { label: "Recaudo", value: formatCOP(mensual.recaudo) },
            ].map((x) => (
              <div key={x.label}>
                <p className="text-xs text-muted-foreground">{x.label}</p>
                <p className="text-base font-semibold tabular-nums">{x.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Suma de {diasReportados} día(s) reportado(s) en el mes. Esta sección es de solo
            lectura: el mensual siempre cuadra con el detalle diario.
          </p>
        </CardContent>
      </Card>

      {fechaFutura && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>No se puede registrar una fecha futura.</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Guardar reemplaza el reporte completo de ese día.
        </p>
        <Button onClick={submit} disabled={fechaFutura}>
          <Save className="size-4" />
          {existentes.hay ? "Actualizar día" : "Guardar día"}
        </Button>
      </div>
    </div>
  )
}
