import { formatByUnit, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface StatItem {
  label: string
  value: number
  unit?: "cantidad" | "moneda" | "porcentaje"
  icon?: React.ComponentType<{ className?: string }>
  /** Meta del período. Sin meta se omite la línea de cumplimiento. */
  target?: number | null
  /** Texto de apoyo cuando no hay meta. */
  hint?: string
}

/**
 * Tira de métricas: una sola tarjeta con las columnas separadas por divisores,
 * en vez de N tarjetas suspendidas. Es el patrón del template y hace que el
 * grupo se lea como una unidad.
 */
export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 sm:p-6 lg:grid-cols-4 lg:gap-6",
        className,
      )}
    >
      {items.map((item, i) => {
        const tieneMeta = typeof item.target === "number" && item.target > 0
        const ratio = tieneMeta ? item.value / item.target! : null

        return (
          <div key={item.label} className="flex items-start">
            <div className="min-w-0 flex-1 space-y-2 sm:space-y-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {item.icon && <item.icon className="size-[18px] shrink-0" />}
                <span className="truncate text-xs font-medium sm:text-sm">{item.label}</span>
              </div>

              <p className="text-xl font-semibold leading-tight tracking-tight tabular-nums lg:text-[28px]">
                {formatByUnit(item.value, item.unit ?? "cantidad")}
              </p>

              {tieneMeta ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium sm:text-sm">
                  <span
                    className={
                      ratio! >= 1
                        ? "text-emerald-600"
                        : ratio! >= 0.6
                          ? "text-amber-600"
                          : "text-red-600"
                    }
                  >
                    {formatPercent(ratio)}
                  </span>
                  <span className="text-muted-foreground">
                    de {formatByUnit(item.target!, item.unit ?? "cantidad")}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {item.hint ?? "Sin meta definida"}
                </p>
              )}
            </div>

            {i < items.length - 1 && (
              <div aria-hidden className="mx-4 hidden h-full w-px bg-border lg:block xl:mx-6" />
            )}
          </div>
        )
      })}
    </div>
  )
}
