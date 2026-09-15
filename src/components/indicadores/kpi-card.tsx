import { MetaEditable } from "@/components/indicadores/meta-editable"
import { formatNumber, formatPercent } from "@/lib/format"
import { leerKpi, type Kpi, type Tono } from "@/lib/indicadores"
import { cn } from "@/lib/utils"

/**
 * Cada tono, en las tres cosas que colorea la tarjeta: el fondo y borde de la
 * tarjeta entera, el texto de la efectividad y la barra. La gerencia pidió
 * que el semáforo se viera de lejos ("un poquito más de color"): con solo el
 * número teñido, diez tarjetas grises se leían igual estuvieran bien o mal.
 */
const TARJETA: Record<Tono, string> = {
  verde: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/40",
  ambar: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/40",
  rojo: "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/40",
  neutro: "bg-card",
}

const TEXTO: Record<Tono, string> = {
  verde: "text-emerald-700 dark:text-emerald-400",
  ambar: "text-amber-700 dark:text-amber-400",
  rojo: "text-rose-700 dark:text-rose-400",
  neutro: "text-muted-foreground",
}

const CHIP: Record<Tono, string> = {
  verde: "bg-emerald-600 text-white",
  ambar: "bg-amber-500 text-white",
  rojo: "bg-rose-600 text-white",
  neutro: "bg-muted text-muted-foreground",
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
 * fondo, en el número y en la barra, para que no puedan discrepar.
 *
 * La meta la puede cambiar quien administra la empresa, en la propia tarjeta.
 */
export function KpiCard({
  kpi,
  companyId,
  editable,
}: {
  kpi: Kpi
  companyId: string
  editable: boolean
}) {
  const valor = (n: number | null) =>
    n === null ? "—" : kpi.unit === "porcentaje" ? formatPercent(n) : formatNumber(Math.round(n * 10) / 10)
  const e = kpi.efectividad
  const { tono, etiqueta, avance, marcaMeta } = leerKpi(kpi)

  return (
    <div className={cn("rounded-xl border p-4", TARJETA[tono])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{kpi.nombre}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{kpi.formula}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4",
            CHIP[tono],
          )}
        >
          {etiqueta}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Meta</dt>
          <MetaEditable companyId={companyId} kpi={kpi} editable={editable} />
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Logrado</dt>
          <dd className="text-base font-semibold tabular-nums">{valor(kpi.logrado)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Efectividad</dt>
          <dd className={cn("text-2xl font-bold leading-7 tabular-nums", TEXTO[tono])}>
            {e === null ? "—" : formatPercent(e, 1)}
          </dd>
        </div>
      </dl>

      <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all", BARRA[tono])}
          style={{ width: `${avance}%` }}
        />
        {/* Cuando la barra no mide contra la meta sino contra el techo, hay que
            decir dónde quedó la meta o el llenado no se puede leer. */}
        {marcaMeta < 100 && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-foreground/50"
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
          <span className="ml-1.5">
            {kpi.unit === "porcentaje" ? "· rojo sobre 100%" : "· rojo si supera las agendas que hubo"}
          </span>
        )}
      </p>
    </div>
  )
}
