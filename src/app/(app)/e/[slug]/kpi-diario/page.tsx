"use client"

import { AlertTriangle, Info, Pencil, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ModuleGuard, useActiveCompany } from "@/components/company-guard"
import { DateRangeFilter, ResponsableFilter } from "@/components/record-filters"
import { EmptyRow, RecordsScaffold } from "@/components/records-scaffold"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatPercent } from "@/lib/format"
import {
  EMPTY_TOTALS,
  KPI_FIELD_LABELS,
  RATIO_BLOCKS,
  computeRatios,
  type KpiTotals,
} from "@/lib/kpi"
import { saveDailyKpi } from "@/lib/data/records-actions"
import {
  useCanManage,
  useCompanyBranches,
  useCompanyMembers,
  useCurrentUser,
  useDb,
  useEffectiveToday,
} from "@/lib/store/hooks"
import { JORNADAS, type DailyKpi, type Jornada } from "@/lib/store/types"

/** Campos digitables, en el orden del pantallazo del Excel. */
const CAMPOS: (keyof KpiTotals)[] = [
  "llamadas_realizadas",
  "llamadas_contestadas",
  "ventas_efectivas",
  "agendas_dia",
  "atencion_agendas",
  "clientes_atendidos",
  "ventas_exitosas",
  "llamada_agenda",
]

const JORNADA_LABEL: Record<Jornada, string> = {
  inicial: "Inicial",
  medio_dia: "Medio día",
  final: "Final",
}

const POR_PAGINA = 12

export default function KpiDiarioPage() {
  return (
    <ModuleGuard module="kpi_diario">
      <KpiDiario />
    </ModuleGuard>
  )
}

function KpiDiario() {
  const company = useActiveCompany()
  const db = useDb()
  const members = useCompanyMembers(company.id)

  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [responsable, setResponsable] = useState("todos")
  const [page, setPage] = useState(0)
  const [editando, setEditando] = useState<DailyKpi | null>(null)
  const [abierto, setAbierto] = useState(false)

  const registros = useMemo(() => {
    return db.daily_kpi
      .filter((k) => k.company_id === company.id)
      .filter((k) => !desde || k.report_date >= desde)
      .filter((k) => !hasta || k.report_date <= hasta)
      .filter((k) => responsable === "todos" || k.user_id === responsable)
      .slice()
      .sort(
        (a, b) =>
          b.report_date.localeCompare(a.report_date) || b.updated_at.localeCompare(a.updated_at),
      )
  }, [db.daily_kpi, company.id, desde, hasta, responsable])

  // Si un filtro deja menos páginas de las que había, la página actual podría
  // quedar fuera de rango y la tabla saldría vacía sin estarlo.
  const paginaSegura = Math.min(page, Math.max(0, Math.ceil(registros.length / POR_PAGINA) - 1))
  const visibles = registros.slice(paginaSegura * POR_PAGINA, (paginaSegura + 1) * POR_PAGINA)

  function abrirNuevo() {
    setEditando(null)
    setAbierto(true)
  }

  function abrirEdicion(registro: DailyKpi) {
    setEditando(registro)
    setAbierto(true)
  }

  if (members.length === 0) {
    return (
      <Alert>
        <Info />
        <AlertDescription>
          {company.name} no tiene usuarios asignados todavía. Asigna al menos uno para poder
          registrar KPIs.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <RecordsScaffold
        title="KPI Diario"
        description="Llamadas, agendas y venta presencial por jornada. Los seis ratios se calculan solos: no se digitan."
        onNew={abrirNuevo}
        total={registros.length}
        page={paginaSegura}
        pageSize={POR_PAGINA}
        onPageChange={setPage}
        filters={
          <>
            <DateRangeFilter desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
            <ResponsableFilter
              value={responsable}
              onChange={(v) => {
                setResponsable(v)
                setPage(0)
              }}
              options={members}
            />
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Fecha</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead className="w-24">Jornada</TableHead>
              <TableHead className="text-right">Llamadas</TableHead>
              <TableHead className="text-right">Contest.</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-right">Agendas</TableHead>
              <TableHead className="text-right">Contactab.</TableHead>
              <TableHead className="text-right">Conversión</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((r) => {
              const ratios = computeRatios(r)
              const sede = db.branches.find((b) => b.id === r.branch_id)
              return (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums">{formatDate(r.report_date)}</TableCell>
                  <TableCell>
                    <p className="truncate text-sm">{r.responsable_nombre}</p>
                    {sede && <p className="truncate text-xs text-muted-foreground">{sede.name}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {JORNADA_LABEL[r.jornada]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.llamadas_realizadas}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.llamadas_contestadas}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {r.ventas_efectivas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.agendas_dia}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatPercent(ratios.ratio_contactabilidad)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatPercent(ratios.ratio_conversion_llamada)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => abrirEdicion(r)}
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">Editar el registro del {r.report_date}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}

            {visibles.length === 0 && (
              <EmptyRow
                colSpan={10}
                filtrando={!!desde || !!hasta || responsable !== "todos"}
              />
            )}
          </TableBody>
        </Table>
      </RecordsScaffold>

      <KpiDialog
        key={editando?.id ?? "nuevo"}
        registro={editando}
        open={abierto}
        onOpenChange={setAbierto}
      />
    </>
  )
}

/**
 * Alta y corrección de un registro.
 *
 * Con `registro` en null nace en blanco. La combinación empresa + fecha +
 * responsable + jornada es única, así que si al guardar ya existe una igual, se
 * corrige esa en vez de duplicarla, y se avisa antes.
 */
function KpiDialog({
  registro,
  open,
  onOpenChange,
}: {
  registro: DailyKpi | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const company = useActiveCompany()
  const db = useDb()
  const me = useCurrentUser()
  const today = useEffectiveToday()
  const members = useCompanyMembers(company.id)
  const branches = useCompanyBranches(company.id)
  const canManage = useCanManage(company.id)

  const [date, setDate] = useState(registro?.report_date ?? today)
  const [jornada, setJornada] = useState<Jornada>(registro?.jornada ?? "final")
  // El asesor solo se registra a sí mismo; quien gestiona puede elegir responsable.
  const [userId, setUserId] = useState(
    registro?.user_id ?? (members.some((m) => m.id === me.id) ? me.id : (members[0]?.id ?? "")),
  )
  const [values, setValues] = useState<KpiTotals>(
    registro
      ? {
          llamadas_realizadas: registro.llamadas_realizadas,
          llamadas_contestadas: registro.llamadas_contestadas,
          ventas_efectivas: registro.ventas_efectivas,
          agendas_dia: registro.agendas_dia,
          atencion_agendas: registro.atencion_agendas,
          clientes_atendidos: registro.clientes_atendidos,
          ventas_exitosas: registro.ventas_exitosas,
          llamada_agenda: registro.llamada_agenda,
        }
      : { ...EMPTY_TOTALS },
  )
  const [notas, setNotas] = useState(registro?.notas ?? "")

  const ratios = computeRatios(values)

  const existente = db.daily_kpi.find(
    (k) =>
      k.company_id === company.id &&
      k.report_date === date &&
      k.user_id === userId &&
      k.jornada === jornada,
  )
  const chocaConOtro = !!existente && existente.id !== registro?.id

  // Las mismas validaciones que los CHECK del schema.
  const errores: string[] = []
  if (values.llamadas_contestadas > values.llamadas_realizadas)
    errores.push("Las llamadas contestadas no pueden superar las realizadas.")
  if (values.atencion_agendas > values.agendas_dia)
    errores.push("La atención de agendas no puede superar las agendas del día.")
  if (values.ventas_exitosas > values.clientes_atendidos)
    errores.push("Las ventas exitosas no pueden superar los clientes atendidos.")
  if (date > today) errores.push("No se puede registrar una fecha futura.")

  const responsable = members.find((m) => m.id === userId)
  // La sede no se elige: un comercial pertenece a una sede y el registro queda
  // ahí. Un coordinador sin sede propia registra en la sede principal.
  const branchId =
    responsable?.branchId ?? branches.find((b) => b.is_primary)?.id ?? branches[0]?.id

  async function guardar() {
    if (errores.length || !userId || !branchId) return
    const r = await saveDailyKpi({
      company_id: company.id,
      branch_id: branchId,
      report_date: date,
      user_id: userId,
      responsable_nombre: responsable?.full_name ?? "—",
      jornada,
      values,
      notas: notas.trim() || undefined,
    })
    if (!r.ok) {
      toast.error(r.error ?? "No se pudo guardar el registro.")
      return
    }
    toast.success(registro || chocaConOtro ? "Registro actualizado" : "Registro guardado", {
      description: `${responsable?.full_name} · ${formatDate(date)} · jornada ${JORNADA_LABEL[jornada].toLowerCase()}`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{registro ? "Editar registro" : "Nuevo registro de KPI"}</DialogTitle>
          <DialogDescription>
            Un registro por empresa + fecha + responsable + jornada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="fecha">Fecha reporte</Label>
            <Input
              id="fecha"
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="responsable">Responsable</Label>
            <Select value={userId} onValueChange={setUserId} disabled={!canManage}>
              <SelectTrigger id="responsable" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                    {m.branchName ? ` · ${m.branchName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="jornada">Jornada</Label>
            <Select value={jornada} onValueChange={(v) => setJornada(v as Jornada)}>
              <SelectTrigger id="jornada" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JORNADAS.map((j) => (
                  <SelectItem key={j.value} value={j.value}>
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            {CAMPOS.map((campo) => (
              <div key={campo} className="grid grid-cols-[1fr_5.5rem] items-center gap-3">
                <Label htmlFor={campo} className="text-sm font-normal">
                  {KPI_FIELD_LABELS[campo]}
                </Label>
                <Input
                  id={campo}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={values[campo]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [campo]: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  className="text-right tabular-nums"
                />
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Ratios calculados</p>
            {RATIO_BLOCKS.map((b) => (
              <div key={b.key} className="flex items-baseline justify-between border-t py-2">
                <div>
                  <p className="text-sm">{b.label}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {values[b.numerador]} / {values[b.denominador]}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatPercent(ratios[b.key])}</span>
              </div>
            ))}
            <p className="border-t pt-2 text-xs text-muted-foreground">
              Cuando el denominador es 0 se muestra &ldquo;—&rdquo;, no 0%: no hay dato, que es
              distinto de un resultado malo.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notas" className="text-sm font-normal">
            Notas (opcional)
          </Label>
          <Textarea
            id="notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Novedades de la jornada"
          />
        </div>

        {chocaConOtro && (
          <Alert>
            <Info />
            <AlertDescription>
              Ya hay un registro de {responsable?.full_name} para esa fecha y jornada. Guardar lo
              va a corregir, no a duplicar.
            </AlertDescription>
          </Alert>
        )}

        {errores.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>
              <ul className="list-inside list-disc">
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={errores.length > 0}>
            <Save className="size-4" />
            {registro ? "Guardar cambios" : "Guardar registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
