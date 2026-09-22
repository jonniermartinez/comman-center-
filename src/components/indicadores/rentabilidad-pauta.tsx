import { formatCOP, formatCOPShort, formatNumber } from "@/lib/format"
import { rentabilidadPauta } from "@/lib/indicadores"
import { cn } from "@/lib/utils"

/**
 * Cuánto rinde la pauta, en el orden en que lo pidió la coordinación:
 * facturación, ventas, inversión, ROAS y costo por venta.
 *
 * Sin inversión anotada, el ROAS y el costo por venta van en "—" y la placa
 * lo dice en palabras: un cero se leería como "la pauta no sirvió".
 */
export function RentabilidadPauta({
  facturacion,
  ventas,
  inversion,
  className,
}: {
  facturacion: number
  ventas: number
  /** null cuando nadie digitó la inversión del período. */
  inversion: number | null
  className?: string
}) {
  const { roas, costoPorVenta } = rentabilidadPauta(facturacion, ventas, inversion)

  const celdas: { label: string; valor: string; exacto?: string; hint?: string; destacada?: boolean }[] = [
    { label: "Facturación", valor: formatCOPShort(facturacion), exacto: formatCOP(facturacion) },
    { label: "Ventas", valor: formatNumber(ventas) },
    {
      label: "Inversión en pauta",
      valor: inversion === null ? "—" : formatCOPShort(inversion),
      exacto: inversion === null ? undefined : formatCOP(inversion),
      hint: inversion === null ? "Sin dato este período" : undefined,
    },
    {
      label: "ROAS",
      valor: roas === null ? "—" : `${roas.toLocaleString("es-CO", { maximumFractionDigits: 1 })}×`,
      hint: roas === null ? "Facturación ÷ inversión" : `Cada peso de pauta devolvió ${roas.toLocaleString("es-CO", { maximumFractionDigits: 1 })}`,
      destacada: true,
    },
    {
      label: "Costo por venta",
      valor: costoPorVenta === null ? "—" : formatCOPShort(costoPorVenta),
      exacto: costoPorVenta === null ? undefined : formatCOP(costoPorVenta),
      hint:
        costoPorVenta === null
          ? inversion === null
            ? "Inversión ÷ ventas"
            : "Sin ventas en el período"
          : undefined,
      destacada: true,
    },
  ]

  return (
    <dl className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5", className)}>
      {celdas.map((c) => (
        <div
          key={c.label}
          className={cn(
            "rounded-lg border px-3 py-2.5",
            c.destacada ? "border-primary/20 bg-primary/5" : "bg-muted/30",
          )}
        >
          <dt className="text-xs font-medium text-muted-foreground">{c.label}</dt>
          <dd className="mt-1 text-2xl font-bold leading-8 tabular-nums" title={c.exacto}>
            {c.valor}
          </dd>
          {c.hint && <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>}
        </div>
      ))}
    </dl>
  )
}
