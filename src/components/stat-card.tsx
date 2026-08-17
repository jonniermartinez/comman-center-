import { Card, CardContent } from "@/components/ui/card"
import { formatByUnit, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Tarjeta de métrica. Con `target` muestra barra de cumplimiento; sin meta
 * definida muestra solo el valor (no una barra en 0%, que se leería como fracaso).
 */
export function StatCard({
  label,
  value,
  unit = "cantidad",
  target,
  hint,
  className,
}: {
  label: string
  value: number
  unit?: "cantidad" | "moneda" | "porcentaje"
  target?: number | null
  hint?: string
  className?: string
}) {
  const hasTarget = typeof target === "number" && target > 0
  const ratio = hasTarget ? value / target : null
  const pct = ratio === null ? 0 : Math.min(100, Math.max(0, ratio * 100))

  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="space-y-2 px-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {formatByUnit(value, unit)}
          </span>
          {hasTarget && (
            <span className="text-xs text-muted-foreground tabular-nums">
              meta {formatByUnit(target, unit)}
            </span>
          )}
        </div>

        {hasTarget ? (
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pct >= 100 ? "bg-emerald-600" : pct >= 60 ? "bg-amber-500" : "bg-rose-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatPercent(ratio, 0)} de la meta
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{hint ?? "Sin meta definida"}</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Bloque de ratio con su numerador y denominador visibles, como en el Excel. */
export function RatioBlock({
  label,
  numeradorLabel,
  numerador,
  denominadorLabel,
  denominador,
  ratio,
}: {
  label: string
  numeradorLabel: string
  numerador: number
  denominadorLabel: string
  denominador: number
  ratio: number | null
}) {
  return (
    <div className="space-y-1.5 border-t py-3 first:border-t-0">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{numeradorLabel}</span>
        <span className="tabular-nums">{numerador}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{denominadorLabel}</span>
        <span className="tabular-nums">{denominador}</span>
      </div>
      <div className="flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
        <span>{label}</span>
        <span className="tabular-nums">{formatPercent(ratio, 0)}</span>
      </div>
    </div>
  )
}
