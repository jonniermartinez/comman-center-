"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatCOP, formatCOPShort, formatNumber } from "@/lib/format"

/**
 * Gráficas del dashboard.
 *
 * Colores: los tokens `--chart-*` de globals.css, validados para daltonismo.
 * Los ejes de dinero van en millones abreviados —una cifra en pesos completa
 * ocupa más que la propia gráfica— y el detalle exacto se ve en el tooltip.
 */

const EJE = { fontSize: 11, fill: "var(--color-muted-foreground)" }

function Marco({ children }: { children: React.ReactElement }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      {children}
    </ResponsiveContainer>
  )
}

function Caja({
  label,
  filas,
}: {
  label: string
  filas: { nombre: string; valor: string }[]
}) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {filas.map((f) => (
        <p key={f.nombre} className="flex justify-between gap-4 text-muted-foreground">
          <span>{f.nombre}</span>
          <span className="font-medium tabular-nums text-foreground">{f.valor}</span>
        </p>
      ))}
    </div>
  )
}

export interface PuntoDia {
  dia: number
  ventas: number
  facturacion: number
  recaudo: number
}

/** Evolución del mes: cuánto se vendió y cuánto entró cada día. */
export function GraficaDiaria({ datos }: { datos: PuntoDia[] }) {
  if (datos.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin movimiento en el mes.</p>
  }

  return (
    <Marco>
      <AreaChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gFact" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="dia" tick={EJE} tickLine={false} axisLine={false} />
        <YAxis tick={EJE} tickLine={false} axisLine={false} width={52}
               tickFormatter={(v) => formatCOPShort(Number(v))} />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Caja
                label={`Día ${label}`}
                filas={[
                  { nombre: "Facturación", valor: formatCOP(Number(payload[0]?.value ?? 0)) },
                  { nombre: "Recaudo", valor: formatCOP(Number(payload[1]?.value ?? 0)) },
                ]}
              />
            ) : null
          }
        />
        <Area type="monotone" dataKey="facturacion" stroke="var(--color-chart-1)" strokeWidth={2}
              fill="url(#gFact)" />
        <Area type="monotone" dataKey="recaudo" stroke="var(--color-chart-3)" strokeWidth={2}
              fill="url(#gRec)" />
      </AreaChart>
    </Marco>
  )
}

export interface Barra {
  nombre: string
  valor: number
  detalle?: string
}

/** Comparación entre categorías: financiaciones, medios de pago, sedes. */
export function GraficaBarras({
  datos,
  moneda,
}: {
  datos: Barra[]
  /** Si el valor es dinero, el eje y el tooltip se formatean como pesos. */
  moneda?: boolean
}) {
  if (datos.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos en el mes.</p>
  }

  const formato = (v: number) => (moneda ? formatCOPShort(v) : formatNumber(v))

  return (
    <Marco>
      <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="nombre" tick={EJE} tickLine={false} axisLine={false} interval={0}
               angle={datos.length > 5 ? -20 : 0} textAnchor={datos.length > 5 ? "end" : "middle"}
               height={datos.length > 5 ? 48 : 28} />
        <YAxis tick={EJE} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formato(Number(v))} />
        <Tooltip
          cursor={{ fill: "var(--color-muted)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <Caja
                label={String(payload[0]?.payload?.nombre ?? "")}
                filas={[
                  {
                    nombre: moneda ? "Valor" : "Cantidad",
                    valor: moneda
                      ? formatCOP(Number(payload[0]?.value ?? 0))
                      : formatNumber(Number(payload[0]?.value ?? 0)),
                  },
                  ...(payload[0]?.payload?.detalle
                    ? [{ nombre: "", valor: String(payload[0].payload.detalle) }]
                    : []),
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
          {datos.map((_, i) => (
            <Cell key={i} fill={`var(--color-chart-${(i % 5) + 1})`} />
          ))}
        </Bar>
      </BarChart>
    </Marco>
  )
}

export interface PasoEmbudo {
  nombre: string
  valor: number
}

/**
 * Embudo de la gestión: de las llamadas a la venta.
 *
 * Se dibuja con barras horizontales proporcionales al primer paso, no con un
 * cono: el cono deforma la comparación —el ojo compara áreas— y acá lo que
 * importa es cuánto se cae entre un paso y el siguiente.
 */
export function Embudo({ pasos }: { pasos: PasoEmbudo[] }) {
  const tope = Math.max(...pasos.map((p) => p.valor), 1)

  return (
    <div className="space-y-3">
      {pasos.map((paso, i) => {
        const anterior = i > 0 ? pasos[i - 1].valor : null
        const caida = anterior && anterior > 0 ? paso.valor / anterior : null
        return (
          <div key={paso.nombre} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span>{paso.nombre}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-semibold tabular-nums">{formatNumber(paso.valor)}</span>
                {caida !== null && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {(caida * 100).toFixed(0)}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, (paso.valor / tope) * 100)}%`,
                  backgroundColor: `var(--color-chart-${(i % 5) + 1})`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
