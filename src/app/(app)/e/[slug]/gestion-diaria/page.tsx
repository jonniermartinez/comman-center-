"use client"

import { ArrowRight, Info, Pencil, Save } from "lucide-react"
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
import { formatDate } from "@/lib/format"
import { managementProgress } from "@/lib/kpi"
import { saveDailyManagement } from "@/lib/data/records-actions"
import {
  useCanManage,
  useCompanyBranches,
  useCompanyMembers,
  useCurrentUser,
  useDb,
  useEffectiveToday,
} from "@/lib/store/hooks"
import { JORNADAS, type DailyManagement, type Jornada } from "@/lib/store/types"

const CAMPOS = [
  { key: "chats_por_responder", label: "Chats por responder" },
  { key: "tareas_del_dia", label: "Tareas del día" },
  { key: "tareas_caducadas", label: "Tareas caducadas" },
  { key: "certificados", label: "Certificados" },
] as const

type Campo = (typeof CAMPOS)[number]["key"]
type Valores = Record<Campo, number>

const VACIO: Valores = {
  chats_por_responder: 0,
  tareas_del_dia: 0,
  tareas_caducadas: 0,
  certificados: 0,
}

const JORNADA_LABEL: Record<Jornada, string> = {
  inicial: "Inicial",
  medio_dia: "Medio día",
  final: "Final",
}

const POR_PAGINA = 12

export default function GestionDiariaPage() {
  return (
    <ModuleGuard module="gestion_diaria">
      <GestionDiaria />
    </ModuleGuard>
  )
}

function GestionDiaria() {
  const company = useActiveCompany()
  const db = useDb()
  const members = useCompanyMembers(company.id)

  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [responsable, setResponsable] = useState("todos")
  const [page, setPage] = useState(0)
  const [editando, setEditando] = useState<DailyManagement | null>(null)
  const [abierto, setAbierto] = useState(false)

  const registros = useMemo(
    () =>
      db.daily_management
        .filter((r) => r.company_id === company.id)
        .filter((r) => !desde || r.report_date >= desde)
        .filter((r) => !hasta || r.report_date <= hasta)
        .filter((r) => responsable === "todos" || r.user_id === responsable)
        .slice()
        .sort(
          (a, b) =>
            b.report_date.localeCompare(a.report_date) ||
            b.updated_at.localeCompare(a.updated_at),
        ),
    [db.daily_management, company.id, desde, hasta, responsable],
  )

  const paginaSegura = Math.min(page, Math.max(0, Math.ceil(registros.length / POR_PAGINA) - 1))
  const visibles = registros.slice(paginaSegura * POR_PAGINA, (paginaSegura + 1) * POR_PAGINA)

  if (members.length === 0) {
    return (
      <Alert>
        <Info />
        <AlertDescription>{company.name} no tiene usuarios asignados todavía.</AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <RecordsScaffold
        title="Gestión Diaria"
        description={`Estado del CRM ${company.crm_label ?? company.name}. Se registra al inicio y al final de la jornada para ver cuánto se depuró en el día.`}
        onNew={() => {
          setEditando(null)
          setAbierto(true)
        }}
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
              <TableHead className="text-right">Chats</TableHead>
              <TableHead className="text-right">Tareas</TableHead>
              <TableHead className="text-right">Caducadas</TableHead>
              <TableHead className="text-right">Certif.</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((r) => {
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
                  <TableCell className="text-right tabular-nums">{r.chats_por_responder}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.tareas_del_dia}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.tareas_caducadas}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.certificados}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        setEditando(r)
                        setAbierto(true)
                      }}
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">Editar el registro del {r.report_date}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}

            {visibles.length === 0 && (
              <EmptyRow colSpan={8} filtrando={!!desde || !!hasta || responsable !== "todos"} />
            )}
          </TableBody>
        </Table>
      </RecordsScaffold>

      <GestionDialog
        key={editando?.id ?? "nuevo"}
        registro={editando}
        open={abierto}
        onOpenChange={setAbierto}
      />
    </>
  )
}

/**
 * Alta y corrección de un registro del CRM.
 *
 * Muestra el comparativo inicial vs final del día del responsable elegido: es
 * el dato que da sentido a capturar dos veces, y verlo mientras se digita evita
 * guardar una jornada final con números mayores que los de la inicial sin
 * darse cuenta.
 */
function GestionDialog({
  registro,
  open,
  onOpenChange,
}: {
  registro: DailyManagement | null
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
  const [jornada, setJornada] = useState<Jornada>(registro?.jornada ?? "inicial")
  const [userId, setUserId] = useState(
    registro?.user_id ?? (members.some((m) => m.id === me.id) ? me.id : (members[0]?.id ?? "")),
  )
  const [values, setValues] = useState<Valores>(
    registro
      ? {
          chats_por_responder: registro.chats_por_responder,
          tareas_del_dia: registro.tareas_del_dia,
          tareas_caducadas: registro.tareas_caducadas,
          certificados: registro.certificados,
        }
      : { ...VACIO },
  )
  const [notas, setNotas] = useState(registro?.notas ?? "")

  const existente = db.daily_management.find(
    (r) =>
      r.company_id === company.id &&
      r.report_date === date &&
      r.user_id === userId &&
      r.jornada === jornada,
  )
  const chocaConOtro = !!existente && existente.id !== registro?.id

  const progreso = managementProgress(
    db.daily_management.filter(
      (r) => r.company_id === company.id && r.report_date === date && r.user_id === userId,
    ),
  )[0]

  const responsable = members.find((m) => m.id === userId)
  // Igual que en KPI: la sede la determina el comercial, no se elige aparte.
  const branchId =
    responsable?.branchId ?? branches.find((b) => b.is_primary)?.id ?? branches[0]?.id
  const fechaFutura = date > today

  async function guardar() {
    if (fechaFutura || !userId || !branchId) return
    const r = await saveDailyManagement({
      company_id: company.id,
      branch_id: branchId,
      report_date: date,
      user_id: userId,
      responsable_nombre: responsable?.full_name ?? "—",
      jornada,
      ...values,
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{registro ? "Editar registro" : "Nuevo registro del CRM"}</DialogTitle>
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
              <div key={campo.key} className="grid grid-cols-[1fr_5.5rem] items-center gap-3">
                <Label htmlFor={campo.key} className="text-sm font-normal">
                  {campo.label}
                </Label>
                <Input
                  id={campo.key}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={values[campo.key]}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [campo.key]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="text-right tabular-nums"
                />
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Depuración del día</p>
            {!progreso ? (
              <p className="text-sm text-muted-foreground">
                Registra la jornada inicial para ver el comparativo.
              </p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_3rem_1.25rem_3rem] items-center gap-2 text-xs text-muted-foreground">
                  <span />
                  <span className="text-right">Inicial</span>
                  <span />
                  <span className="text-right">Final</span>
                </div>
                {[
                  { label: "Chats", ini: progreso.chats_inicial, fin: progreso.chats_final },
                  { label: "Tareas", ini: progreso.tareas_inicial, fin: progreso.tareas_final },
                  {
                    label: "Caducadas",
                    ini: progreso.caducadas_inicial,
                    fin: progreso.caducadas_final,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1fr_3rem_1.25rem_3rem] items-center gap-2 border-t py-2 text-sm"
                  >
                    <span>{row.label}</span>
                    <span className="text-right tabular-nums">{row.ini}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <span
                      className={
                        row.ini - row.fin > 0
                          ? "text-right font-semibold tabular-nums text-emerald-600"
                          : "text-right font-semibold tabular-nums"
                      }
                    >
                      {row.fin}
                    </span>
                  </div>
                ))}
                <p className="border-t pt-2 text-xs text-muted-foreground">
                  Lo depurado es la diferencia entre la jornada inicial y la final: cuánto bajó la
                  cola de trabajo durante el día.
                </p>
              </div>
            )}
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
            {registro ? "Guardar cambios" : "Guardar registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
