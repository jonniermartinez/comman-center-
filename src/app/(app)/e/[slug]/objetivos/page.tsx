"use client"

import { AlertTriangle, Copy, Lock, LockOpen } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useActiveCompany } from "@/components/company-guard"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatByUnit, formatPercent } from "@/lib/format"
import {
  businessDaysElapsed,
  businessDaysInMonth,
  monthLabel,
  monthOf,
  objectiveProgress,
  realValueFor,
} from "@/lib/kpi"
import {
  copyObjectivesFromPreviousMonth,
  setLockMonth,
  setObjective,
} from "@/lib/store/actions"
import {
  useCanManage,
  useCompanyMembers,
  useDb,
  useEffectiveToday,
  useIsSuperAdmin,
} from "@/lib/store/hooks"

export default function ObjetivosPage() {
  const company = useActiveCompany()
  const db = useDb()
  const today = useEffectiveToday()
  const members = useCompanyMembers(company.id)
  const canManage = useCanManage(company.id)
  const isSuperAdmin = useIsSuperAdmin()

  const [month, setMonth] = useState(monthOf(today))

  const progreso = objectiveProgress(db, company.id, month, today)
  const bloqueado = progreso.length > 0 && progreso.every((p) => p.objective.locked)
  const puedeEditar = canManage && (!bloqueado || isSuperAdmin)

  const elapsed = businessDaysElapsed(month, today)
  const totalDias = businessDaysInMonth(month)

  // Métricas de empresa vs métricas por responsable.
  const metricasEmpresa = db.metrics.filter((m) =>
    ["ventas_mensuales", "licencias_mensuales", "facturacion", "recaudo"].includes(m.code),
  )
  const metricasPersona = db.metrics.filter((m) =>
    ["ventas_efectivas", "ratio_contactabilidad", "ratio_conversion_llamada"].includes(m.code),
  )

  function metaDe(metricCode: string, userId?: string | null) {
    return db.objectives.find(
      (o) =>
        o.company_id === company.id &&
        o.period_month === month &&
        o.metric_code === metricCode &&
        (o.user_id ?? null) === (userId ?? null),
    )
  }

  function guardar(metricCode: string, userId: string | null, raw: string) {
    const value = Math.max(0, Number(raw) || 0)
    setObjective({
      company_id: company.id,
      period_month: month,
      metric_code: metricCode,
      user_id: userId,
      target_value: value,
    })
  }

  /** Advierte (no bloquea) si la suma de metas individuales no cuadra con la de empresa. */
  function descuadre(metricCode: string): { suma: number; meta: number } | null {
    const meta = metaDe(metricCode, null)?.target_value
    if (!meta) return null
    const suma = members.reduce(
      (a, m) => a + (metaDe(metricCode, m.id)?.target_value ?? 0),
      0,
    )
    if (suma === 0 || suma === meta) return null
    return { suma, meta }
  }

  return (
    <>
      <PageHeader
        title="Objetivos comerciales"
        description={`Metas de ${company.name} por mes y por responsable. El cumplimiento se calcula contra el acumulado real y se proyecta según días hábiles.`}
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label htmlFor="mes" className="sr-only">
                Mes
              </Label>
              <Input
                id="mes"
                type="month"
                value={month.slice(0, 7)}
                onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)}
                className="w-40"
              />
            </div>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const n = copyObjectivesFromPreviousMonth(company.id, month)
                  if (n > 0) toast.success(`${n} meta(s) copiadas del mes anterior`)
                  else toast.info("No hay metas nuevas que copiar del mes anterior")
                }}
              >
                <Copy className="size-4" />
                Copiar del mes anterior
              </Button>
            )}
            {isSuperAdmin && progreso.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLockMonth(company.id, month, !bloqueado)
                  toast.success(bloqueado ? "Mes desbloqueado" : "Mes bloqueado")
                }}
              >
                {bloqueado ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                {bloqueado ? "Desbloquear mes" : "Bloquear mes"}
              </Button>
            )}
          </>
        }
      />

      {bloqueado && (
        <Alert className="mb-4">
          <Lock />
          <AlertDescription>
            {monthLabel(month)} está cerrado.{" "}
            {isSuperAdmin
              ? "Como super admin puedes desbloquearlo para editar."
              : "Solo el super admin puede modificar las metas de un mes cerrado."}
          </AlertDescription>
        </Alert>
      )}

      {!canManage && (
        <Alert className="mb-4">
          <AlertDescription>
            Estás viendo las metas en modo lectura. Definir objetivos requiere rol de coordinador o
            super admin.
          </AlertDescription>
        </Alert>
      )}

      {/* Metas de empresa */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Metas de empresa · {monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="w-44 text-right">Meta</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">Cumplimiento</TableHead>
                <TableHead className="text-right">Proyección a fin de mes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metricasEmpresa.map((metric) => {
                const objetivo = metaDe(metric.code, null)
                const real = realValueFor(db, company.id, month, metric.code, null)
                const cumpl = objetivo?.target_value ? real / objetivo.target_value : null
                const proy = elapsed ? (real / elapsed) * totalDias : real
                const mismatch = descuadre(metric.code)

                return (
                  <TableRow key={metric.code}>
                    <TableCell className="font-medium">
                      {metric.name}
                      {mismatch && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-amber-600">
                          <AlertTriangle className="size-3" />
                          la suma individual da {formatByUnit(mismatch.suma, metric.unit)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step={metric.unit === "moneda" ? 100_000 : 1}
                        inputMode="numeric"
                        disabled={!puedeEditar}
                        defaultValue={objetivo?.target_value ?? 0}
                        key={`${metric.code}-${month}-${objetivo?.target_value ?? 0}`}
                        onBlur={(e) => guardar(metric.code, null, e.target.value)}
                        className="ml-auto w-40 text-right tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatByUnit(real, metric.unit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {cumpl === null ? (
                        <span className="text-muted-foreground">sin meta</span>
                      ) : (
                        <CumplBadge ratio={cumpl} />
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {objetivo?.target_value ? formatByUnit(Math.round(proy), metric.unit) : "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Proyección: real ÷ {elapsed} día(s) hábiles transcurridos × {totalDias} del mes.
          </p>
        </CardContent>
      </Card>

      {/* Metas por responsable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metas por responsable</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta empresa no tiene usuarios asignados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsable</TableHead>
                    {metricasPersona.map((m) => (
                      <TableHead key={m.code} className="text-right">
                        {m.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.full_name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {member.companyRole}
                        </span>
                      </TableCell>
                      {metricasPersona.map((metric) => {
                        const objetivo = metaDe(metric.code, member.id)
                        const real = realValueFor(db, company.id, month, metric.code, member.id)
                        const cumpl = objetivo?.target_value
                          ? real / objetivo.target_value
                          : null
                        return (
                          <TableCell key={metric.code} className="text-right">
                            <Input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              disabled={!puedeEditar}
                              defaultValue={objetivo?.target_value ?? 0}
                              key={`${metric.code}-${member.id}-${month}-${objetivo?.target_value ?? 0}`}
                              onBlur={(e) => guardar(metric.code, member.id, e.target.value)}
                              className="ml-auto w-24 text-right tabular-nums"
                            />
                            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                              real {formatByUnit(Math.round(real), metric.unit)}
                              {cumpl !== null && ` · ${formatPercent(cumpl)}`}
                            </p>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Dejar una meta en 0 equivale a no tener meta: en el dashboard la métrica se muestra sin
            barra de cumplimiento en vez de aparecer como 0%.
          </p>
        </CardContent>
      </Card>
    </>
  )
}

function CumplBadge({ ratio }: { ratio: number }) {
  const variant = ratio >= 1 ? "default" : ratio >= 0.6 ? "secondary" : "destructive"
  return (
    <Badge variant={variant} className="tabular-nums">
      {formatPercent(ratio)}
    </Badge>
  )
}
