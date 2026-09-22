import { cn } from "@/lib/utils"

/**
 * Tarjeta base del sistema visual: borde de 1px, radio xl, superficie blanca
 * sobre el fondo gris de la página. Reemplaza el uso directo de `<Card>` para
 * que todas las secciones tengan el mismo padding y radio.
 *
 * Lleva `min-w-0` porque suele ser hija de una rejilla: sin él, una tabla
 * adentro obliga a la columna a medir lo que mide la tabla y en celular la
 * página entera se desborda hacia el lado.
 */
export function SectionCard({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("min-w-0 rounded-xl border bg-card p-4 sm:p-6", className)}
      {...props}
    >
      {children}
    </section>
  )
}

/**
 * Encabezado de tarjeta: chip cuadrado con borde e icono, título, y espacio a la
 * derecha para leyenda o acciones.
 */
export function SectionCardHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-3 sm:mb-6", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {Icon && (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10"
          >
            <Icon className="size-[18px] text-primary" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium">{title}</h2>
          {description && (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Punto de color + etiqueta. Identidad de serie en las gráficas. */
export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  )
}
