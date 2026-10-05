"use client"

import { AlertTriangle, Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useActiveCompany } from "@/components/company-guard"
import { MoneyInput } from "@/components/money-input"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
} from "@/lib/kpi"
import { useBusinessDays, useObjectiveProgress } from "@/lib/data/client-queries"
import { setBusinessDays } from "@/lib/data/companies-actions"
import {
  copyObjectivesFromPreviousMonth,
  setObjective,
} from "@/lib/data/records-actions"
import {
  useCanManage,
  useCompanyMembers,
  useDb,
  useEffectiveToday,
} from "@/lib/store/hooks"
import { usePeriodo } from "@/lib/store/periodo"

export default function ObjetivosPage() {
  const company = useActiveCompany()
  const db = useDb()
  const today = useEffectiveToday()
  const members = useCompanyMembers(company.id)
  const canManage = useCanManage(company.id)

  const { mes: month } = usePeriodo()

  // Meta y real vienen juntos de `v_objective_progress`: calcular el real acá
  // sería repetir en TypeScript las sumas que ya hace Postgres, y es cuestión
  // de tiempo que las dos versiones dejen de coincidir.
  const { datos: progreso } = useObjectiveProgress(company.id, month)
  const puedeEditar = canManage

  // Las metas por persona se guardan contra su cuenta, así que solo aplican a
  // quien tiene una: alguien sin cuenta no puede tener meta individual todavía.
  const conCuenta = members.filter((m) => m.profile_id)

  /** La fila de la vista para una métrica y, si aplica, una persona. */
  function filaDe(metricCode: string, userId?: string | null) {
    return progreso.find(
      (p) => p.metric_code === metricCode && (p.user_id ?? null) === (userId ?? null),
    )
  }

  // Los dos números de la proyección salen del calendario —lunes a sábado,
  // hasta hoy— salvo que la empresa los haya fijado a mano (060): un festivo o
  // un cierre no los conoce el calendario.
  const { datos: fijados, fijar } = useBusinessDays(company.id, month)
  const totalCalendario = businessDaysInMonth(month)
  const totalDias = fijados.dias ?? totalCalendario
  // De un mes ya cerrado transcurrieron todos sus días, los que se hayan fijado.
  const elapsedCalendario =
    businessDaysElapsed(month, today) === totalCalendario
      ? totalDias
      : Math.min(businessDaysElapsed(month, today), totalDias)
  const elapsed = fijados.transcurridos ?? elapsedCalendario

  async function guardarDias(campo: "dias" | "transcurridos", valor: number | null) {
    const r = await setBusinessDays(company.id, month, { [campo]: valor })
    if (r.ok) fijar({ [campo]: valor })
    else toast.error(r.error ?? "No se pudieron guardar los días.")
  }

  // Métricas de empresa vs métricas por responsable.
  const metricasEmpresa = db.metrics.filter((m) =>
    ["ventas_mensuales", "licencias_mensuales", "facturacion", "recaudo"].includes(m.code),
  )
  const metricasPersona = db.metrics.filter((m) =>
    ["ventas_efectivas", "ratio_contactabilidad", "ratio_conversion_llamada"].includes(m.code),
  )

  function metaDe(metricCode: string, userId?: string | null) {
    const fila = filaDe(metricCode, userId)
    return fila ? { target_value: Number(fila.target_value) } : undefined
  }

  async function guardar(metricCode: string, userId: string | null, raw: number | string) {
    const value = Math.max(0, Number(raw) || 0)
    const r = await setObjective({
      company_id: company.id,
      period_month: month,
      metric_code: metricCode,
      user_id: userId,
      target_value: value,
    })
    if (!r.ok) toast.error(r.error ?? "No se pudo guardar la meta.")
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
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const r = await copyObjectivesFromPreviousMonth(company.id, month)
                  if (!r.ok) toast.error(r.error)
                  else if (r.copiadas) toast.success(`${r.copiadas} meta(s) copiadas del mes anterior`)
                  else toast.info("No hay metas nuevas que copiar del mes anterior")
                }}
              >
                <Copy className="size-4" />
                Copiar del mes anterior
              </Button>
            )}
          </>
        }
      />


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
                const real = Number(filaDe(metric.code, null)?.real_value ?? 0)
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
                      <MetaInput
                        key={`${metric.code}-${month}-${objetivo?.target_value ?? 0}`}
                        unit={metric.unit}
                        disabled={!puedeEditar}
                        valorInicial={objetivo?.target_value ?? 0}
                        onGuardar={(valor) => guardar(metric.code, null, valor)}
                        className="ml-auto w-40"
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
          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs text-muted-foreground">
            <span>Proyección: real ÷</span>
            <DiasInput
              key={`transcurridos-${month}-${fijados.transcurridos}`}
              etiqueta="Días hábiles transcurridos"
              valor={fijados.transcurridos}
              porDefecto={elapsedCalendario}
              minimo={0}
              disabled={!puedeEditar}
              onGuardar={(v) => guardarDias("transcurridos", v)}
            />
            <span>día(s) hábiles transcurridos ×</span>
            <DiasInput
              key={`dias-${month}-${fijados.dias}`}
              etiqueta="Días hábiles del mes"
              valor={fijados.dias}
              porDefecto={totalCalendario}
              minimo={1}
              disabled={!puedeEditar}
              onGuardar={(v) => guardarDias("dias", v)}
            />
            <span>del mes.</span>
            {puedeEditar && (
              <span className="basis-full">
                Los dos se pueden escribir a mano. Vacío, se cuentan del calendario (lunes a
                sábado); un número puesto a mano no avanza solo, hay que actualizarlo.
              </span>
            )}
          </div>
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
                  {conCuenta.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      {metricasPersona.map((metric) => {
                        const objetivo = metaDe(metric.code, member.profile_id)
                        const real = Number(
                          filaDe(metric.code, member.profile_id)?.real_value ?? 0,
                        )
                        const cumpl = objetivo?.target_value
                          ? real / objetivo.target_value
                          : null
                        return (
                          <TableCell key={metric.code} className="text-right">
                            <MetaInput
                              key={`${metric.code}-${member.id}-${month}-${objetivo?.target_value ?? 0}`}
                              unit={metric.unit}
                              disabled={!puedeEditar}
                              valorInicial={objetivo?.target_value ?? 0}
                              onGuardar={(valor) => guardar(metric.code, member.profile_id!, valor)}
                              className="ml-auto w-28"
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

/**
 * Casilla de días de la proyección.
 *
 * Vacía muestra lo que cuenta el calendario y no fija nada; con un número, ese
 * manda. Guarda al salir del campo, como las metas.
 */
function DiasInput({
  etiqueta,
  valor,
  porDefecto,
  minimo,
  disabled,
  onGuardar,
}: {
  etiqueta: string
  /** Lo fijado a mano, o null si se está usando el calendario. */
  valor: number | null
  porDefecto: number
  minimo: number
  disabled?: boolean
  onGuardar: (valor: number | null) => void
}) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor))

  function guardar() {
    const n = Number(texto)
    if (texto !== "" && (!Number.isInteger(n) || n < minimo || n > 31)) {
      toast.error(`${etiqueta}: va de ${minimo} a 31.`)
      setTexto(valor === null ? "" : String(valor))
      return
    }
    const nuevo = texto === "" ? null : n
    if (nuevo !== valor) onGuardar(nuevo)
  }

  return (
    <Input
      type="number"
      min={minimo}
      max={31}
      inputMode="numeric"
      aria-label={etiqueta}
      disabled={disabled}
      value={texto}
      placeholder={String(porDefecto)}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="h-7 w-14 px-1.5 text-center text-xs tabular-nums text-foreground"
    />
  )
}

/**
 * Casilla de meta.
 *
 * Las metas de dinero llevan separador de miles: en pesos, `18000000` no se lee
 * de un vistazo y equivocarse en un cero cambia la meta por diez. Las de
 * cantidad y porcentaje siguen siendo un número normal.
 *
 * Guarda al salir del campo, no en cada tecla: si no, escribir "30" guardaría
 * primero una meta de 3.
 */
function MetaInput({
  unit,
  valorInicial,
  onGuardar,
  disabled,
  className,
}: {
  unit: "cantidad" | "moneda" | "porcentaje"
  valorInicial: number
  onGuardar: (valor: number) => void
  disabled?: boolean
  className?: string
}) {
  const [valor, setValor] = useState(valorInicial)

  if (unit === "moneda") {
    return (
      <MoneyInput
        value={valor}
        onValueChange={setValor}
        disabled={disabled}
        onBlur={() => onGuardar(valor)}
        className={className}
      />
    )
  }

  return (
    <Input
      type="number"
      min={0}
      inputMode="numeric"
      disabled={disabled}
      value={valor}
      onChange={(e) => setValor(Math.max(0, Number(e.target.value) || 0))}
      onBlur={() => onGuardar(valor)}
      className={`text-right tabular-nums ${className ?? ""}`}
    />
  )
}
