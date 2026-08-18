import { formatByUnit, formatCOPShort, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface StatItem {
  label: string
  value: number
  unit?: "cantidad" | "moneda" | "porcentaje"
  icon?: React.ComponentType<{ className?: string }>
  /** Meta del período. Sin meta se omite la línea de cumplimiento. */
  target?: number | null
  /**
   * Texto de apoyo cuando no hay meta. Sin él no se escribe nada: repetir
   * "sin meta definida" bajo cada cifra era ruido en todas las pantallas.
   */
  hint?: string
}

/**
 * Tira de métricas: una sola tarjeta con las columnas separadas por divisores,
 * en vez de N tarjetas suspendidas. Es el patrón del template y hace que el
 * grupo se lea como una unidad.
 */
export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  // Las columnas siguen al número de métricas: con cinco en una rejilla de
  // cuatro, la quinta caía sola en una segunda fila y la tira dejaba de leerse
  // como un grupo.
  const columnas: Record<number, string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 sm:p-6 lg:gap-6",
        columnas[items.length] ?? "lg:grid-cols-4",
        className,
      )}
    >
      {items.map((item, i) => {
        const tieneMeta = typeof item.target === "number" && item.target > 0
        const ratio = tieneMeta ? item.value / item.target! : null
        const unidad = item.unit ?? "cantidad"
        const exacto = formatByUnit(item.value, unidad)

        // Un importe en pesos puede tener diez dígitos y no cabe en su columna.
        // Arriba va abreviado, que es lo que se lee de un vistazo, y el valor
        // exacto queda escrito debajo: recortarlo con puntos suspensivos o
        // esconderlo tras el cursor obliga a cazar el número que uno vino a ver.
        const abreviar = unidad === "moneda" && Math.abs(item.value) >= 1_000_000
        const principal = abreviar ? formatCOPShort(item.value) : exacto

        return (
          <div key={item.label} className="flex items-start">
            <div className="min-w-0 flex-1 space-y-2 sm:space-y-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {item.icon && <item.icon className="size-[18px] shrink-0" />}
                <span className="truncate text-xs font-medium sm:text-sm">{item.label}</span>
              </div>

              <p className="text-xl font-semibold leading-tight tracking-tight tabular-nums lg:text-[28px]">
                {principal}
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
                  <span className="text-muted-foreground">de {formatByUnit(item.target!, unidad)}</span>
                </div>
              ) : abreviar || item.hint ? (
                // Si la cifra se abrevió, el exacto va primero: es lo que la
                // persona vino a leer. El texto de apoyo lo acompaña, no lo
                // reemplaza.
                <p className="text-xs tabular-nums text-muted-foreground sm:text-sm">
                  {[abreviar ? exacto : null, item.hint].filter(Boolean).join(" · ")}
                </p>
              ) : null}
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
