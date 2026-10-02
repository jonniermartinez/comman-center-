import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MESES_COMPARATIVO, type MesComparado } from "@/lib/data/dashboard"
import { formatCOP, formatNumber } from "@/lib/format"
import { rentabilidadPauta } from "@/lib/indicadores"
import { monthLabel } from "@/lib/kpi"
import { cn } from "@/lib/utils"

/**
 * La pauta mes contra mes: el que se está mirando y los anteriores.
 *
 * Un ROAS suelto no dice si es bueno o malo; al lado de los dos meses
 * anteriores sí. Sin inversión anotada el ROAS y el costo por venta van en
 * "—", igual que en la placa del mes.
 */
export function ComparativoPauta({
  meses,
  cuantos,
  hrefMeses,
}: {
  meses: MesComparado[]
  /** Cuántos meses se están mostrando. */
  cuantos: number
  /** El enlace que cambia cuántos meses se comparan, conservando el mes elegido. */
  hrefMeses: (n: number) => string
}) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs print:hidden">
        <span className="mr-1 text-muted-foreground">Comparar</span>
        {MESES_COMPARATIVO.map((n) => (
          <Link
            key={n}
            href={hrefMeses(n)}
            scroll={false}
            className={cn(
              "rounded-md border px-2.5 py-1 font-medium transition-colors",
              n === cuantos ? "border-primary/40 bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {n === 12 ? "Último año" : `${n} meses`}
          </Link>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mes</TableHead>
            <TableHead className="text-right">Ventas</TableHead>
            <TableHead className="text-right">Facturación</TableHead>
            <TableHead className="text-right">Presupuesto autorizado</TableHead>
            <TableHead className="text-right">Invertido en pauta</TableHead>
            <TableHead className="text-right">ROAS</TableHead>
            <TableHead className="text-right">Costo por venta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {meses.map((m, i) => {
            const { roas, costoPorVenta } = rentabilidadPauta(m.facturacion, m.ventas, m.invertido)
            return (
              <TableRow key={m.mes} className={i === 0 ? "font-medium" : undefined}>
                <TableCell>{monthLabel(m.mes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(m.ventas)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCOP(m.facturacion)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {m.presupuesto === null ? "—" : formatCOP(m.presupuesto)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.invertido === null ? "—" : formatCOP(m.invertido)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {roas === null ? "—" : `${roas.toLocaleString("es-CO", { maximumFractionDigits: 1 })}×`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {costoPorVenta === null ? "—" : formatCOP(Math.round(costoPorVenta))}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </>
  )
}
