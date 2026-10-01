import { formatCOP, formatCOPShort, formatNumber, formatPercent } from "@/lib/format"
import { rentabilidadPauta } from "@/lib/indicadores"
import { cn } from "@/lib/utils"

export interface Placa {
  label: string
  valor: string
  /** El valor sin abreviar, para el `title`. */
  exacto?: string
  hint?: string
  destacada?: boolean
}

/** La rejilla de placas que comparten la pauta y el cumplimiento del mes. */
export function Placas({ celdas, className }: { celdas: Placa[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3", className)}>
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

/** Un importe abreviado con su valor exacto, o "—" si no hay dato. */
export function pesos(n: number | null): Pick<Placa, "valor" | "exacto"> {
  return n === null ? { valor: "—" } : { valor: formatCOPShort(n), exacto: formatCOP(n) }
}

/**
 * Cuánto rinde la pauta, en el orden en que lo pidió la coordinación:
 * facturación, ventas, presupuesto autorizado, lo invertido, ROAS y costo por
 * venta.
 *
 * El presupuesto es lo que se autorizó para el mes y lo invertido es lo que de
 * verdad va gastado: el ROAS y el costo por venta se calculan sobre lo
 * invertido. Sin ese dato van en "—" y la placa lo dice en palabras: un cero
 * se leería como "la pauta no sirvió".
 */
export function RentabilidadPauta({
  facturacion,
  ventas,
  presupuesto,
  inversion,
  className,
}: {
  facturacion: number
  ventas: number
  /** null cuando nadie digitó el presupuesto autorizado del período. */
  presupuesto: number | null
  /** null cuando nadie digitó la inversión del período. */
  inversion: number | null
  className?: string
}) {
  const { roas, costoPorVenta } = rentabilidadPauta(facturacion, ventas, inversion)

  const celdas: Placa[] = [
    { label: "Facturación", ...pesos(facturacion) },
    { label: "Ventas", valor: formatNumber(ventas) },
    {
      label: "Presupuesto autorizado",
      ...pesos(presupuesto),
      hint: presupuesto === null ? "Sin dato este período" : undefined,
    },
    {
      label: "Invertido en pauta",
      ...pesos(inversion),
      hint:
        inversion === null
          ? "Sin dato este período"
          : presupuesto
            ? `${formatPercent(inversion / presupuesto)} del presupuesto`
            : undefined,
    },
    {
      label: "ROAS",
      valor: roas === null ? "—" : `${roas.toLocaleString("es-CO", { maximumFractionDigits: 1 })}×`,
      hint: roas === null ? "Facturación ÷ invertido" : `Cada peso de pauta devolvió ${roas.toLocaleString("es-CO", { maximumFractionDigits: 1 })}`,
      destacada: true,
    },
    {
      label: "Costo por venta",
      ...pesos(costoPorVenta),
      hint:
        costoPorVenta === null
          ? inversion === null
            ? "Invertido ÷ ventas"
            : "Sin ventas en el período"
          : undefined,
      destacada: true,
    },
  ]

  return <Placas celdas={celdas} className={cn("lg:grid-cols-6", className)} />
}
