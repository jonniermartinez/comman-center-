"use client"

import { AlertTriangle, Check, Info, Save } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatPercent } from "@/lib/format"
import {
  EMPTY_TOTALS,
  KPI_FIELD_LABELS,
  RATIO_BLOCKS,
  computeRatios,
  type KpiTotals,
} from "@/lib/kpi"
import { saveDailyKpi } from "@/lib/store/actions"
import {
  useCanManage,
  useCompanyBranches,
  useCompanyMembers,
  useCurrentUser,
  useDb,
  useEffectiveToday,
} from "@/lib/store/hooks"
import { JORNADAS, type Jornada } from "@/lib/store/types"

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

export default function KpiDiarioPage() {
  return (
    <ModuleGuard module="kpi_diario">
      <KpiDiarioForm />
    </ModuleGuard>
  )
}

function KpiDiarioForm() {
  const company = useActiveCompany()
  const db = useDb()
  const me = useCurrentUser()
  const today = useEffectiveToday()
  const members = useCompanyMembers(company.id)
  const branches = useCompanyBranches(company.id)
  const canManage = useCanManage(company.id)

  const [date, setDate] = useState(today)
  const [jornada, setJornada] = useState<Jornada>("final")
  // El asesor solo se registra a sí mismo; quien gestiona puede elegir responsable.
  const [userId, setUserId] = useState(
    members.some((m) => m.id === me.id) ? me.id : (members[0]?.id ?? ""),
  )
  const [values, setValues] = useState<KpiTotals>({ ...EMPTY_TOTALS })
  const [notas, setNotas] = useState("")

  const existing = useMemo(
    () =>
      db.daily_kpi.find(
        (k) =>
          k.company_id === company.id &&
          k.report_date === date &&
          k.user_id === userId &&
          k.jornada === jornada,
      ),
    [db.daily_kpi, company.id, date, userId, jornada],
  )

  // Al cambiar de fecha/responsable/jornada se carga el registro existente:
  // reenviar edita, no duplica. Se ajusta en render (no en un efecto) para que
  // el formulario nunca pinte un frame con los datos del registro anterior.
  const slotKey = `${date}|${userId}|${jornada}`
  const [loadedSlot, setLoadedSlot] = useState<string | null>(null)
  if (loadedSlot !== slotKey) {
    setLoadedSlot(slotKey)
    setValues(
      existing
        ? {
            llamadas_realizadas: existing.llamadas_realizadas,
            llamadas_contestadas: existing.llamadas_contestadas,
            ventas_efectivas: existing.ventas_efectivas,
            agendas_dia: existing.agendas_dia,
            atencion_agendas: existing.atencion_agendas,
            clientes_atendidos: existing.clientes_atendidos,
            ventas_exitosas: existing.ventas_exitosas,
            llamada_agenda: existing.llamada_agenda,
          }
        : { ...EMPTY_TOTALS },
    )
    setNotas(existing?.notas ?? "")
  }

  const ratios = computeRatios(values)

  // Las mismas validaciones que los CHECK del schema.
  const errores: string[] = []
  if (values.llamadas_contestadas > values.llamadas_realizadas)
    errores.push("Las llamadas contestadas no pueden superar las realizadas.")
  if (values.atencion_agendas > values.agendas_dia)
    errores.push("La atención de agendas no puede superar las agendas del día.")
  if (values.ventas_exitosas > values.clientes_atendidos)
    errores.push("Las ventas exitosas no pueden superar los clientes atendidos.")
  if (date > today) errores.push("No se puede registrar una fecha futura.")

  const puedeEditarResponsable = canManage
  const responsable = members.find((m) => m.id === userId)

  // La sede no se elige: un comercial pertenece a una sede y el registro queda
  // ahí. Un coordinador sin sede propia registra en la sede principal.
  const branchId = responsable?.branchId ?? branches.find((b) => b.is_primary)?.id ?? branches[0]?.id

  function submit() {
    if (errores.length || !userId || !branchId) return
    saveDailyKpi({
      company_id: company.id,
      branch_id: branchId,
      report_date: date,
      user_id: userId,
      jornada,
      values,
      notas: notas.trim() || undefined,
    })
    const sede = branches.find((b) => b.id === branchId)
    toast.success(existing ? "Registro actualizado" : "Registro guardado", {
      description: `${responsable?.full_name} · ${sede?.name} · ${formatDate(date)} · jornada ${jornada.replace("_", " ")}`,
    })
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
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="KPI Diario"
        description="Reemplaza la hoja de KPI del Excel. Los seis ratios se calculan automáticamente: no se digitan."
        actions={
          existing && (
            <Badge variant="secondary" className="gap-1">
              <Check className="size-3" />
              Ya registrado — editando
            </Badge>
          )
        }
      />

      {/* Encabezado, igual que el del Excel */}
      <Card className="mb-4">
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha reporte</Label>
            <Input
              id="fecha"
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsable">Responsable</Label>
            <Select value={userId} onValueChange={setUserId} disabled={!puedeEditarResponsable}>
              <SelectTrigger id="responsable">
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
            <p className="text-xs text-muted-foreground">
              {responsable?.branchName
                ? `Sede: ${responsable.branchName}`
                : "Sin sede propia: se registra en la sede principal."}
              {!puedeEditarResponsable && " · Como asesor solo registras a tu nombre."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jornada">Jornada</Label>
            <Select value={jornada} onValueChange={(v) => setJornada(v as Jornada)}>
              <SelectTrigger id="jornada">
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
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Captura */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del día</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CAMPOS.map((campo) => (
              <div key={campo} className="grid grid-cols-[1fr_6rem] items-center gap-3">
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

            <div className="space-y-2 border-t pt-3">
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
          </CardContent>
        </Card>

        {/* Ratios en vivo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ratios calculados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            {RATIO_BLOCKS.map((b) => (
              <div key={b.key} className="flex items-baseline justify-between border-t py-2.5 first:border-t-0">
                <div>
                  <p className="text-sm">{b.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {values[b.numerador]} / {values[b.denominador]}
                  </p>
                </div>
                <span className="text-lg font-semibold tabular-nums">
                  {formatPercent(ratios[b.key])}
                </span>
              </div>
            ))}
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Cuando el denominador es 0 se muestra &ldquo;—&rdquo;, no 0%: no hay dato, que es
              distinto de un resultado malo.
            </p>
          </CardContent>
        </Card>
      </div>

      {errores.length > 0 && (
        <Alert variant="destructive" className="mt-4">
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

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Un registro por empresa + fecha + responsable + jornada. Volver a guardar edita el
          existente.
        </p>
        <Button onClick={submit} disabled={errores.length > 0}>
          <Save className="size-4" />
          {existing ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </div>
  )
}
