import { cn } from "@/lib/utils"

/**
 * Encabezado de página al estilo del template: título grande y semibold,
 * subtítulo en muted con los datos importantes resaltados, y acciones alineadas
 * abajo a la derecha.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-6",
        className,
      )}
    >
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{title}</h1>
        {description && (
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">{actions}</div>
      )}
    </div>
  )
}

/** Resalta un dato dentro del subtítulo, como "3 new leads" en el template. */
export function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>
}
