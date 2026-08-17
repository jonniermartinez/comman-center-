"use client"

import { ArrowRight, Check, Info, Save } from "lucide-react"
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
import { formatDate } from "@/lib/format"
import { managementProgress } from "@/lib/kpi"
import { saveDailyManagement } from "@/lib/store/actions"
import {
  useCanManage,
  useCompanyBranches,
  useCompanyMembers,
  useCurrentUser,
  useDb,
  useEffectiveToday,
} from "@/lib/store/hooks"
import { JORNADAS, type Jornada } from "@/lib/store/types"

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

export default function GestionDiariaPage() {
  return (
    <ModuleGuard module="gestion_diaria">
      <GestionDiariaForm />
    </ModuleGuard>
  )
}

function GestionDiariaForm() {
  const company = useActiveCompany()
  const db = useDb()
  const me = useCurrentUser()
  const today = useEffectiveToday()
  const members = useCompanyMembers(company.id)
  const branches = useCompanyBranches(company.id)
  const canManage = useCanManage(company.id)

  const [date, setDate] = useState(today)
  const [jornada, setJornada] = useState<Jornada>("inicial")
  const [userId, setUserId] = useState(
    members.some((m) => m.id === me.id) ? me.id : (members[0]?.id ?? ""),
  )
  const [values, setValues] = useState<Valores>({ ...VACIO })
  const [notas, setNotas] = useState("")

  const existing = useMemo(
    () =>
      db.daily_management.find(
        (r) =>
          r.company_id === company.id &&
          r.report_date === date &&
          r.user_id === userId &&
          r.jornada === jornada,
      ),
    [db.daily_management, company.id, date, userId, jornada],
  )

  // Carga del registro existente al cambiar de slot. Se ajusta en render, no en
  // un efecto, para no pintar un frame con los datos del registro anterior.
  const slotKey = `${date}|${userId}|${jornada}`
  const [loadedSlot, setLoadedSlot] = useState<string | null>(null)
  if (loadedSlot !== slotKey) {
    setLoadedSlot(slotKey)
    setValues(
      existing
        ? {
            chats_por_responder: existing.chats_por_responder,
            tareas_del_dia: existing.tareas_del_dia,
            tareas_caducadas: existing.tareas_caducadas,
            certificados: existing.certificados,
          }
        : { ...VACIO },
    )
    setNotas(existing?.notas ?? "")
  }

  // Comparativo inicial vs final del día, como en el Excel.
  const progreso = useMemo(
    () =>
      managementProgress(
        db.daily_management.filter(
          (r) => r.company_id === company.id && r.report_date === date && r.user_id === userId,
        ),
      )[0],
    [db.daily_management, company.id, date, userId],
  )

  const responsable = members.find((m) => m.id === userId)
  // Igual que en KPI: la sede la determina el comercial, no se elige aparte.
  const branchId =
    responsable?.branchId ?? branches.find((b) => b.is_primary)?.id ?? branches[0]?.id
  const fechaFutura = date > today

  function submit() {
    if (fechaFutura || !userId || !branchId) return
    saveDailyManagement({
      company_id: company.id,
      branch_id: branchId,
      report_date: date,
      user_id: userId,
      jornada,
      ...values,
      notas: notas.trim() || undefined,
    })
    toast.success(existing ? "Registro actualizado" : "Registro guardado", {
      description: `${responsable?.full_name} · ${formatDate(date)} · jornada ${jornada.replace("_", " ")}`,
    })
  }

  if (members.length === 0) {
    return (
      <Alert>
        <Info />
        <AlertDescription>
          {company.name} no tiene usuarios asignados todavía.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Gestión Diaria"
        description={`Estado del CRM ${company.crm_label ?? company.name}. Se registra al inicio y al final de la jornada para ver cuánto se depuró en el día.`}
        actions={
          existing && (
            <Badge variant="secondary" className="gap-1">
              <Check className="size-3" />
              Ya registrado — editando
            </Badge>
          )
        }
      />

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
            <Select value={userId} onValueChange={setUserId} disabled={!canManage}>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              CRM · {company.crm_label ?? company.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CAMPOS.map((campo) => (
              <div key={campo.key} className="grid grid-cols-[1fr_6rem] items-center gap-3">
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

            <div className="space-y-2 border-t pt-3">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Depuración del día</CardTitle>
          </CardHeader>
          <CardContent>
            {!progreso ? (
              <p className="text-sm text-muted-foreground">
                Registra la jornada inicial para ver el comparativo.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_3rem_1.5rem_3rem] items-center gap-2 text-xs text-muted-foreground">
                  <span />
                  <span className="text-right">Inicial</span>
                  <span />
                  <span className="text-right">Final</span>
                </div>
                {[
                  { label: "Chats por responder", ini: progreso.chats_inicial, fin: progreso.chats_final },
                  { label: "Tareas del día", ini: progreso.tareas_inicial, fin: progreso.tareas_final },
                  { label: "Tareas caducadas", ini: progreso.caducadas_inicial, fin: progreso.caducadas_final },
                ].map((row) => {
                  const depurado = row.ini - row.fin
                  return (
                    <div
                      key={row.label}
                      className="grid grid-cols-[1fr_3rem_1.5rem_3rem] items-center gap-2 border-t pt-2.5 text-sm"
                    >
                      <span>{row.label}</span>
                      <span className="text-right tabular-nums">{row.ini}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <span
                        className={
                          depurado > 0
                            ? "text-right font-semibold tabular-nums text-emerald-600"
                            : "text-right font-semibold tabular-nums"
                        }
                      >
                        {row.fin}
                      </span>
                    </div>
                  )
                })}
                <div className="border-t pt-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Certificados</span>
                    <span className="font-semibold tabular-nums">{progreso.certificados}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lo depurado es la diferencia entre la jornada inicial y la final: cuánto bajó la
                  cola de trabajo durante el día.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {fechaFutura && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>No se puede registrar una fecha futura.</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Un registro por empresa + fecha + responsable + jornada.
        </p>
        <Button onClick={submit} disabled={fechaFutura}>
          <Save className="size-4" />
          {existing ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </div>
  )
}
