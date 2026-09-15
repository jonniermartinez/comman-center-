import { formatNumber, formatPercent } from "@/lib/format"
import { leerKpi, type Kpi, type Tono } from "@/lib/indicadores"
import { cn } from "@/lib/utils"

/** Cada tono en color de texto y de barra. Lo único que decide la tarjeta. */
const TEXTO: Record<Tono, string> = {
  verde: "text-emerald-600",
  ambar: "text-amber-600",
  rojo: "text-red-600",
  neutro: "text-muted-foreground",
}

const BARRA: Record<Tono, string> = {
  verde: "bg-emerald-600",
  ambar: "bg-amber-500",
  rojo: "bg-rose-500",
  neutro: "",
}

/**
 * Un KPI con meta, tal como pidió la gerencia: meta, logrado y efectividad.
 *
 * El color no sale de acá: cada indicador se lee distinto —hay metas que se
 * empujan sin techo y otras que también se pueden pasar de largo— y esa regla
 * vive en `lib/indicadores.ts`. La tarjeta pide el tono y lo pinta, en el
 * número y en la barra, para que los dos no puedan discrepar.
 */
export function KpiCard({ kpi }: { kpi: Kpi }) {
  const valor = (n: number | null) =>
    n === null ? "—" : kpi.unit === "porcentaje" ? formatPercent(n) : formatNumber(Math.round(n * 10) / 10)
  const meta = kpi.unit === "porcentaje" ? formatPercent(kpi.meta) : formatNumber(kpi.meta)
  const e = kpi.efectividad
  const { tono, avance, marcaMeta } = leerKpi(kpi)

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
          <dd className={cn("text-base font-semibold tabular-nums", TEXTO[tono])}>
            {e === null ? "—" : formatPercent(e, 1)}
          </dd>
        </div>
      </dl>

      <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", BARRA[tono])}
          style={{ width: `${avance}%` }}
        />
        {/* Cuando la barra no mide contra la meta sino contra el techo, hay que
            decir dónde quedó la meta o el llenado no se puede leer. */}
        {marcaMeta < 100 && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-px bg-foreground/40"
            style={{ left: `${marcaMeta}%` }}
          />
        )}
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
        {formatNumber(kpi.numerador)} ÷ {formatNumber(kpi.denominador)}
        {kpi.tope !== null && (
          <span className="ml-1.5">· rojo sobre {formatPercent(kpi.tope)}</span>
        )}
        {kpi.semaforo === "con_techo" && (
          <span className="ml-1.5">· rojo sobre 100%</span>
        )}
      </p>
    </div>
  )
}
