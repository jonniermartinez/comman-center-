import { formatNumber, formatPercent } from "@/lib/format"
import type { Kpi } from "@/lib/indicadores"
import { cn } from "@/lib/utils"

/**
 * Un KPI con meta, tal como pidió la gerencia: meta, logrado y efectividad.
 *
 * La efectividad es logrado ÷ meta, y es lo que colorea la tarjeta: verde al
 * 100 %, ámbar por encima del 80 %, rojo debajo. Debajo va la fracción con la
 * que se calculó, para que el número se pueda discutir con los datos delante.
 */
export function KpiCard({ kpi }: { kpi: Kpi }) {
  const valor = (n: number | null) =>
    n === null ? "—" : kpi.unit === "porcentaje" ? formatPercent(n) : formatNumber(Math.round(n * 10) / 10)
  const meta = kpi.unit === "porcentaje" ? formatPercent(kpi.meta) : formatNumber(kpi.meta)
  const e = kpi.efectividad
  const tono =
    e === null
      ? "text-muted-foreground"
      : e >= 1
        ? "text-emerald-600"
        : e >= 0.8
          ? "text-amber-600"
          : "text-red-600"
  const barra = e === null ? 0 : Math.min(100, Math.max(0, e * 100))

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-medium">{kpi.nombre}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{kpi.formula}</p>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Meta</dt>
          <dd className="text-base font-medium tabular-nums">{meta}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Logrado</dt>
          <dd className="text-base font-semibold tabular-nums">{valor(kpi.logrado)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Efectividad</dt>
          <dd className={cn("text-base font-semibold tabular-nums", tono)}>
            {e === null ? "—" : formatPercent(e, 1)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            e === null ? "" : e >= 1 ? "bg-emerald-600" : e >= 0.8 ? "bg-amber-500" : "bg-rose-500",
          )}
          style={{ width: `${barra}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
        {formatNumber(kpi.numerador)} ÷ {formatNumber(kpi.denominador)}
      </p>
    </div>
  )
}
