"use client"

import { Info, Pencil, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ModuleGuard, useActiveCompany } from "@/components/company-guard"
import { MoneyInput } from "@/components/money-input"
import { DateRangeFilter } from "@/components/record-filters"
import { EmptyRow, RecordsScaffold } from "@/components/records-scaffold"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCOP, formatDate, formatNumber } from "@/lib/format"
import { companyMonthTotals, isSameMonth, monthLabel, monthOf } from "@/lib/kpi"
import { saveSalesReport } from "@/lib/data/records-actions"
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

/**
 * Un día reportado por una sede.
 *
 * A diferencia de los otros dos módulos, acá no hay una fila por registro: el
 * formulario guarda muchas líneas (una por financiación y por medio de pago) y
 * lo que tiene sentido listar es el día completo, con sus totales.
 */
interface DiaReportado {
  key: string
  branch_id: string
  report_date: string
  ventas: number
  licencias: number
  renovaciones: number
  facturacion: number
  recaudo: number
}

const POR_PAGINA = 12

export default function ReporteVentasPage() {
  return (
    <ModuleGuard module="reporte_ventas">
      <ReporteVentas />
    </ModuleGuard>
  )
}

function ReporteVentas() {
  const company = useActiveCompany()
  const db = useDb()
  const today = useEffectiveToday()
  const canManage = useCanManage(company.id)
  const branches = useCompanyBranches(company.id)

  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [sede, setSede] = useState("todas")
  const [page, setPage] = useState(0)
  const [editando, setEditando] = useState<DiaReportado | null>(null)
  const [abierto, setAbierto] = useState(false)

  const dias = useMemo(() => {
    const acumulado = new Map<string, DiaReportado>()

    const tomar = (branch_id: string, report_date: string) => {
      const key = `${report_date}|${branch_id}`
      if (!acumulado.has(key)) {
        acumulado.set(key, {
          key,
          branch_id,
          report_date,
          ventas: 0,
          licencias: 0,
          renovaciones: 0,
          facturacion: 0,
          recaudo: 0,
        })
      }
      return acumulado.get(key)!
    }

    for (const s of db.sales_entries) {
      if (s.company_id !== company.id) continue
      const dia = tomar(s.branch_id, s.report_date)
      if (s.kind === "venta") {
        dia.ventas += s.ventas
        dia.licencias += s.licencias
      } else {
        dia.renovaciones += s.ventas
      }
    }
    for (const b of db.billing_entries) {
      if (b.company_id !== company.id) continue
      tomar(b.branch_id, b.report_date).facturacion += b.amount
    }
    for (const c of db.collection_entries) {
      if (c.company_id !== company.id) continue
      tomar(c.branch_id, c.report_date).recaudo += c.amount
    }

    return [...acumulado.values()]
      .filter((d) => !desde || d.report_date >= desde)
      .filter((d) => !hasta || d.report_date <= hasta)
      .filter((d) => sede === "todas" || d.branch_id === sede)
      .sort((a, b) => b.report_date.localeCompare(a.report_date))
  }, [db.sales_entries, db.billing_entries, db.collection_entries, company.id, desde, hasta, sede])

  const paginaSegura = Math.min(page, Math.max(0, Math.ceil(dias.length / POR_PAGINA) - 1))
  const visibles = dias.slice(paginaSegura * POR_PAGINA, (paginaSegura + 1) * POR_PAGINA)

  // El mensual no se digita: es la suma de los diarios ya guardados.
  const month = monthOf(today)
  const mensual = companyMonthTotals(db, company.id, month)
  const diasReportados = new Set(
    db.sales_entries
      .filter((s) => s.company_id === company.id && isSameMonth(s.report_date, month))
      .map((s) => s.report_date),
  ).size

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
    <>
      <RecordsScaffold
        title="Reporte de Ventas"
        description="Ventas, licencias, renovaciones, facturación y recaudo por día y sede. El mensual no se digita: es la suma de los diarios."
        newLabel="Nuevo reporte"
        onNew={() => {
          setEditando(null)
          setAbierto(true)
        }}
        total={dias.length}
        page={paginaSegura}
        pageSize={POR_PAGINA}
        onPageChange={setPage}
        filters={
          <>
            <DateRangeFilter desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
            {branches.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sede</Label>
                <Select
                  value={sede}
                  onValueChange={(v) => {
                    setSede(v)
                    setPage(0)
                  }}
                >
                  <SelectTrigger className="w-52">
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
              </div>
            )}
          </>
        }
        footer={
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
                Suma de {diasReportados} día(s) reportado(s) en el mes. Es de solo lectura: el
                mensual siempre cuadra con el detalle diario.
              </p>
            </CardContent>
          </Card>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Fecha</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-right">Licencias</TableHead>
              <TableHead className="text-right">Renov.</TableHead>
              <TableHead className="text-right">Facturación</TableHead>
              <TableHead className="text-right">Recaudo</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((d) => (
              <TableRow key={d.key}>
                <TableCell className="tabular-nums">{formatDate(d.report_date)}</TableCell>
                <TableCell className="truncate text-sm">
                  {branches.find((b) => b.id === d.branch_id)?.name ?? "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{d.ventas}</TableCell>
                <TableCell className="text-right tabular-nums">{d.licencias}</TableCell>
                <TableCell className="text-right tabular-nums">{d.renovaciones}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCOP(d.facturacion)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCOP(d.recaudo)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => {
                      setEditando(d)
                      setAbierto(true)
                    }}
                  >
                    <Pencil className="size-4" />
                    <span className="sr-only">Editar el reporte del {d.report_date}</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {visibles.length === 0 && (
              <EmptyRow colSpan={8} filtrando={!!desde || !!hasta || sede !== "todas"} />
            )}
          </TableBody>
        </Table>
      </RecordsScaffold>

      <ReporteDialog
        key={editando?.key ?? "nuevo"}
        dia={editando}
        open={abierto}
        onOpenChange={setAbierto}
      />
    </>
  )
}

/**
 * Captura del día completo de una sede.
 *
 * Guardar reemplaza ese día en esa sede: el formulario es la única fuente de
 * verdad de ese día, así que una financiación que se deja en cero desaparece
 * en vez de quedar como línea vieja.
 */
function ReporteDialog({
  dia,
  open,
  onOpenChange,
}: {
  dia: DiaReportado | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const company = useActiveCompany()
  const db = useDb()
  const today = useEffectiveToday()
  const branches = useCompanyBranches(company.id)
  const myBranch = useMyBranch(company.id)
  const financiaciones = useCompanyCatalog(company.id, "financing")
  const medios = useCompanyCatalog(company.id, "payment")

  const [date, setDate] = useState(dia?.report_date ?? today)
  // Las ventas se reportan por sede. Se abre en la sede del usuario, o en la
  // principal si supervisa toda la empresa.
  const [branchId, setBranchId] = useState(
    dia?.branch_id ?? myBranch ?? branches.find((b) => b.is_primary)?.id ?? branches[0]?.id ?? "",
  )
  const [ventas, setVentas] = useState<VentaMap>({})
  const [renovaciones, setRenovaciones] = useState<NumMap>({})
  const [facturacion, setFacturacion] = useState<NumMap>({})
  const [recaudo, setRecaudo] = useState<NumMap>({})

  // Carga del día existente al cambiar de fecha o sede. Se ajusta en render, no
  // en un efecto, para no pintar un frame con los datos del día anterior.
  const slotKey = `${branchId}|${date}`
  const [loadedSlot, setLoadedSlot] = useState<string | null>(null)
  if (loadedSlot !== slotKey) {
    setLoadedSlot(slotKey)
    const delDia = (r: { company_id: string; branch_id: string; report_date: string }) =>
      r.company_id === company.id && r.branch_id === branchId && r.report_date === date

    const v: VentaMap = {}
    const r: NumMap = {}
    for (const s of db.sales_entries.filter(delDia)) {
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
    setFacturacion(
      Object.fromEntries(db.billing_entries.filter(delDia).map((b) => [b.code, b.amount])),
    )
    setRecaudo(
      Object.fromEntries(db.collection_entries.filter(delDia).map((c) => [c.code, c.amount])),
    )
  }

  const totalVentas = Object.values(ventas).reduce((a, v) => a + (v.ventas || 0), 0)
  const totalLicencias = Object.values(ventas).reduce((a, v) => a + (v.licencias || 0), 0)
  const totalFacturacion = Object.values(facturacion).reduce((a, v) => a + (v || 0), 0)
  const totalRecaudo = Object.values(recaudo).reduce((a, v) => a + (v || 0), 0)

  const fechaFutura = date > today
  const yaReportado =
    db.sales_entries.some(
      (s) => s.company_id === company.id && s.branch_id === branchId && s.report_date === date,
    ) ||
    db.billing_entries.some(
      (b) => b.company_id === company.id && b.branch_id === branchId && b.report_date === date,
    )

  async function guardar() {
    if (fechaFutura || !branchId) return
    const r = await saveSalesReport({
      company_id: company.id,
      branch_id: branchId,
      report_date: date,
      ventas,
      renovaciones,
      facturacion,
      recaudo,
    })
    if (!r.ok) {
      toast.error(r.error ?? "No se pudo guardar el reporte.")
      return
    }
    const sede = branches.find((b) => b.id === branchId)
    toast.success(yaReportado ? "Reporte actualizado" : "Reporte guardado", {
      description: `${sede?.name} · ${formatDate(date)} · ${totalVentas} venta(s), ${totalLicencias} licencia(s), ${formatCOP(totalFacturacion)} facturado.`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{dia ? "Editar reporte del día" : "Nuevo reporte de ventas"}</DialogTitle>
          <DialogDescription>
            Guardar reemplaza el reporte completo de ese día en esa sede.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 space-y-2">
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

          <div className="ml-auto grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Ventas</p>
              <p className="text-lg font-semibold tabular-nums">{totalVentas}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Facturación</p>
              <p className="text-lg font-semibold tabular-nums">{formatCOP(totalFacturacion)}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="ventas">
          <TabsList>
            <TabsTrigger value="ventas">Ventas</TabsTrigger>
            <TabsTrigger value="renovaciones">Renovaciones</TabsTrigger>
            <TabsTrigger value="facturacion">Facturación</TabsTrigger>
            <TabsTrigger value="recaudo">Recaudo</TabsTrigger>
          </TabsList>

          <TabsContent value="ventas" className="pt-2">
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
                <Label className="text-sm font-normal">{f.name}</Label>
                <Input
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
              <span>Total</span>
              <span className="text-right tabular-nums">{totalVentas}</span>
              <span className="text-right tabular-nums">{totalLicencias}</span>
            </div>
          </TabsContent>

          <TabsContent value="renovaciones" className="pt-2">
            {financiaciones.map((f) => (
              <div
                key={f.code}
                className="grid grid-cols-[1fr_8rem] items-center gap-3 border-b py-2"
              >
                <Label className="text-sm font-normal">{f.name}</Label>
                <Input
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
          </TabsContent>

          <TabsContent value="facturacion" className="pt-2">
            {financiaciones.map((f) => (
              <div
                key={f.code}
                className="grid grid-cols-[1fr_10rem] items-center gap-3 border-b py-2"
              >
                <Label htmlFor={`f-${f.code}`} className="text-sm font-normal">
                  {f.name}
                </Label>
                <MoneyInput
                  id={`f-${f.code}`}
                  value={facturacion[f.code] ?? 0}
                  onValueChange={(monto) =>
                    setFacturacion((prev) => ({ ...prev, [f.code]: monto }))
                  }
                />
              </div>
            ))}
            <div className="grid grid-cols-[1fr_10rem] items-center gap-3 pt-3 text-sm font-semibold">
              <span>Total facturación</span>
              <span className="pr-3 text-right tabular-nums">{formatCOP(totalFacturacion)}</span>
            </div>
          </TabsContent>

          <TabsContent value="recaudo" className="pt-2">
            {medios.map((m) => (
              <div
                key={m.code}
                className="grid grid-cols-[1fr_10rem] items-center gap-3 border-b py-2"
              >
                <Label htmlFor={`rc-${m.code}`} className="text-sm font-normal">
                  {m.name}
                </Label>
                <MoneyInput
                  id={`rc-${m.code}`}
                  value={recaudo[m.code] ?? 0}
                  onValueChange={(monto) => setRecaudo((prev) => ({ ...prev, [m.code]: monto }))}
                />
              </div>
            ))}
            <div className="grid grid-cols-[1fr_10rem] items-center gap-3 pt-3 text-sm font-semibold">
              <span>Total recaudo</span>
              <span className="pr-3 text-right tabular-nums">{formatCOP(totalRecaudo)}</span>
            </div>
          </TabsContent>
        </Tabs>

        {fechaFutura && (
          <Alert variant="destructive">
            <AlertDescription>No se puede registrar una fecha futura.</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={fechaFutura}>
            <Save className="size-4" />
            {yaReportado ? "Guardar cambios" : "Guardar reporte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
