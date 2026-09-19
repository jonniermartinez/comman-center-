import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { Cola } from "@/lib/agendas"
import { cn } from "@/lib/utils"

/**
 * Las cuatro vistas del módulo.
 *
 * Son enlaces y no pestañas de JavaScript porque la cola está en la URL: se
 * puede mandar por chat («mira lo que hay para hoy»), volver atrás funciona, y
 * cada vista se renderiza en el servidor con lo suyo en vez de traer las
 * cuatro colas para enseñar una.
 */
export function ColasNav({
  base,
  actual,
  conteos,
}: {
  base: string
  actual: Cola
  conteos: { hoy: number; validar: number; seguimiento: number }
}) {
  const pestanas: { id: Cola; label: string; total?: number }[] = [
    { id: "hoy", label: "Hoy", total: conteos.hoy },
    { id: "validar", label: "Por validar", total: conteos.validar },
    { id: "seguimiento", label: "Seguimiento", total: conteos.seguimiento },
    { id: "historico", label: "Histórico" },
  ]

  return (
    <nav
      aria-label="Colas de agendas"
      className="mb-4 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1"
    >
      {pestanas.map((p) => {
        const activa = p.id === actual
        return (
          <Link
            key={p.id}
            href={p.id === "hoy" ? base : `${base}?cola=${p.id}`}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activa
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {p.label}
            {p.total !== undefined && p.total > 0 && (
              <Badge
                variant={activa ? "default" : "secondary"}
                className="h-4 px-1.5 text-[10px] tabular-nums"
              >
                {p.total}
              </Badge>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
