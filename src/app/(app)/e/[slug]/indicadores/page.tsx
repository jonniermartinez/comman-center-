import { notFound } from "next/navigation"

import { DiasHabiles } from "@/components/indicadores/dias-habiles"
import { FiltrosIndicadores } from "@/components/indicadores/filtros"
import { KpiCard } from "@/components/indicadores/kpi-card"
import { PageHeader } from "@/components/page-header"
import { SectionCard, SectionCardHeader } from "@/components/section-card"
import { StatStrip } from "@/components/stat-strip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCompanyContext } from "@/lib/data/company"
import { loadIndicadores } from "@/lib/data/indicadores"
import { formatCOP, formatDate, formatNumber, formatPercent } from "@/lib/format"
import {
  consolidar,
  facturacionTotal,
  finDeMes,
  kpisDe,
  mesesDe,
  promediosDe,
  repartoPorCanal,
  type FilaIndicadores,
} from "@/lib/indicadores"
import { businessDaysInMonth, monthLabel } from "@/lib/kpi"
import { mesActivo } from "@/lib/store/periodo-server"

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Tablero de indicadores: los 14 KPI que pidió la gerencia, con filtros de
 * empresa, comerciales y fecha.
 *
 * Todo sale de `indicadores_por_comercial` (044): una fila por comercial con
 * la gestión y las ventas del rango. El consolidado es la suma de las filas
 * filtradas y los ratios se rehacen sobre esa suma. Las metas viven en
 * `lib/indicadores.ts`, porque son una regla del negocio y no un dato.
 */
export default async function IndicadoresPage({
  params,
  searchParams,
}: PageProps<"/e/[slug]/indicadores">) {
  const { slug } = await params
  const sp = await searchParams
  const company = await getCompanyContext(slug)
  if (!company) notFound()

  // Sin fechas en la URL, el mes que están mirando todas las pantallas.
  const mes = await mesActivo(sp.mes)
  const desde = typeof sp.desde === "string" && FECHA.test(sp.desde) ? sp.desde : mes
  const hasta =
    typeof sp.hasta === "string" && FECHA.test(sp.hasta) && sp.hasta >= desde
      ? sp.hasta
      : desde === mes
        ? finDeMes(mes)
        : desde
  const seleccionados =
    typeof sp.c === "string" && sp.c
      ? sp.c.split(",").filter((id) => company.staff.some((s) => s.id === id))
      : []

  const datos = await loadIndicadores(company.id, desde, hasta)
  const filas = (
    seleccionados.length ? datos.filas.filter((f) => f.staff_id && seleccionados.includes(f.staff_id)) : datos.filas
  ).sort((a, b) => b.total_llamadas - a.total_llamadas)

  const total = consolidar(filas)
  const conJornada = filas.filter((f) => f.dias_laborados > 0).length
  const kpis = kpisDe(total, datos.diasHabiles, conJornada)
  const promedios = promediosDe(total)
  const reparto = repartoPorCanal(total)
  const meses = mesesDe(desde, hasta)
  const periodo =
    desde === hasta
      ? formatDate(desde)
      : desde === mes && hasta === finDeMes(mes)
        ? monthLabel(mes)
        : `${formatDate(desde)} – ${formatDate(hasta)}`

  const pct = (n: number, d: number) => formatPercent(d ? n / d : null)

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Indicadores"
        description={`${company.name} · ${periodo}. Gestión y ventas de ${
          seleccionados.length ? `${filas.length} comercial(es)` : "todo el equipo"
        }, con la meta y la efectividad de cada indicador.`}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltrosIndicadores
          comerciales={company.staff}
          desde={desde}
          hasta={hasta}
          seleccionados={seleccionados}
        />
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {meses.slice(0, 3).map((m) => (
            <DiasHabiles
              key={m}
              companyId={company.id}
              mes={m}
              valor={datos.configurados.find((c) => c.period_month === m)?.dias ?? null}
              porDefecto={businessDaysInMonth(m)}
              editable={company.canManage}
            />
          ))}
          {/* Los días hábiles que había y las jornadas que de verdad se
              registraron se leen juntos o no dicen nada: es el punto de partida
              de media docena de indicadores. */}
          <Registradas valor={total.dias_laborados} comerciales={conJornada} />
        </div>
      </div>

      {/* ============ Resumen ============ */}
      <StatStrip
        className="mb-6"
        items={[
          { label: "Jornadas registradas", value: total.dias_laborados, unit: "cantidad", hint: `${conJornada} comercial(es) · ${datos.diasHabiles} días hábiles` },
          { label: "Llamadas", value: total.total_llamadas, unit: "cantidad", hint: `${formatNumber(total.llamadas_contestadas)} contestadas` },
          { label: "Agendas", value: total.total_agendas, unit: "cantidad", hint: `${formatNumber(total.atencion_agenda)} atendidas` },
          { label: "Ventas (base)", value: total.ventas_total, unit: "cantidad", hint: `${total.ventas_presencial} presenciales · ${total.ventas_digital} digitales` },
          { label: "Facturación total", value: facturacionTotal(total), unit: "moneda", hint: `Valor final ${formatCOP(total.valor_final)}` },
        ]}
      />

      {/* ============ KPI 1 · Validación presencial / digital ============ */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2">
          <SectionCardHeader
            title="Validación de ventas presenciales y digitales"
            description="Lo que dice la base de ventas contra lo que tipificó el equipo en gestión diaria. Deberían coincidir."
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Según Ventas</TableHead>
                <TableHead className="text-right">Según Gestión diaria</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <FilaCruce
                tipo="Presencial"
                fuente="Atención venta exitosa + externa"
                base={total.ventas_presencial}
                gestion={total.atencion_venta + total.atencion_venta_externa}
              />
              <FilaCruce
                tipo="Digital"
                fuente="Llamada efectiva"
                base={total.ventas_digital}
                gestion={total.llamada_efectiva}
              />
              <TableRow className="font-medium">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(total.ventas_presencial + total.ventas_digital)}
                  {total.ventas_sin_tipo > 0 && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      +{total.ventas_sin_tipo} sin tipo
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(total.atencion_venta + total.atencion_venta_externa + total.llamada_efectiva)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader
            title="Distribución por canal"
            description="Ventas presenciales ÷ total de ventas y digitales ÷ total. Los dos suman 100 %, así que van sin meta y sin semáforo: es un reparto, no un objetivo."
          />
          <dl className="space-y-3">
            <Distribucion
              label="Presencial"
              valor={reparto.presencial.cantidad}
              ratio={reparto.presencial.ratio}
              total={reparto.conTipo}
            />
            <Distribucion
              label="Digital"
              valor={reparto.digital.cantidad}
              ratio={reparto.digital.ratio}
              total={reparto.conTipo}
            />
          </dl>
          {reparto.sinTipo > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {reparto.sinTipo} venta(s) no dicen si fueron presenciales o digitales y quedan fuera
              del reparto.
            </p>
          )}
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-sm font-medium">Promedios por jornada</p>
            <dl className="space-y-1.5 text-sm">
              <Promedio label="Agendas" valor={promedios.agendas} />
              <Promedio label="Llamadas contestadas" valor={promedios.contestadas} />
              <Promedio label="Atención presencial" valor={promedios.atencion_presencial} />
            </dl>
          </div>
        </SectionCard>
      </div>

      {/* ============ KPI 4–13 · Metas ============ */}
      <SectionCard className="mt-4">
        <SectionCardHeader
          title="Indicadores con meta"
          description="Meta, logrado y efectividad (logrado ÷ meta), sobre los totales del filtro. No todos se colorean igual: unos se empujan sin techo, en otros pasar del 100 % delata un error de captura, y venta presencial y seguimiento tienen un óptimo del que también se puede uno pasar."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => (
            <KpiCard key={k.code} kpi={k} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Días laborados: {formatNumber(total.dias_laborados)} jornadas registradas contra{" "}
          {datos.diasHabiles} días hábiles por comercial. Facturación total = valor final − (adición
          + descuento), como la definió la gerencia.
        </p>
      </SectionCard>

      {/* ============ KPI 2 · Totales por comercial ============ */}
      <SectionCard className="mt-4">
        <SectionCardHeader
          title="Totales por comercial"
          description="La hoja de gestión sumada por persona en el período. La última fila es el consolidado."
        />
        <div className="overflow-x-auto">
          <TablaTotales filas={filas} total={total} />
        </div>
      </SectionCard>

      {/* ============ Cantidad de ventas ============ */}
      <SectionCard className="mt-4">
        <SectionCardHeader
          title="Cantidad de ventas"
          description="Cuántas ventas hizo cada comercial, no cuánto facturó."
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comercial</TableHead>
              <TableHead className="text-right">Presencial</TableHead>
              <TableHead className="text-right">Digital</TableHead>
              <TableHead className="text-right">Sin tipo</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Valor final</TableHead>
              <TableHead className="text-right">Facturación total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas
              .filter((f) => f.ventas_total > 0)
              .sort((a, b) => b.ventas_total - a.ventas_total)
              .map((f) => (
                <TableRow key={f.staff_id ?? "sin"}>
                  <TableCell className="text-sm">{f.responsable_nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.ventas_presencial}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.ventas_digital}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{f.ventas_sin_tipo}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{f.ventas_total}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(f.valor_final)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(facturacionTotal(f))}</TableCell>
                </TableRow>
              ))}
            <TableRow className="font-medium">
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">{total.ventas_presencial}</TableCell>
              <TableCell className="text-right tabular-nums">{total.ventas_digital}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{total.ventas_sin_tipo}</TableCell>
              <TableCell className="text-right tabular-nums">{total.ventas_total}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCOP(total.valor_final)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCOP(facturacionTotal(total))}</TableCell>
            </TableRow>
            {filas.every((f) => f.ventas_total === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  Sin ventas en el período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          {pct(total.ventas_presencial, total.ventas_presencial + total.ventas_digital)} presencial ·{" "}
          {pct(total.ventas_digital, total.ventas_presencial + total.ventas_digital)} digital.
        </p>
      </SectionCard>
    </div>
  )
}

function FilaCruce({
  tipo,
  fuente,
  base,
  gestion,
}: {
  tipo: string
  fuente: string
  base: number
  gestion: number
}) {
  const diff = gestion - base
  return (
    <TableRow>
      <TableCell>
        <p className="text-sm font-medium">{tipo}</p>
        <p className="text-xs text-muted-foreground">{fuente}</p>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(base)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(gestion)}</TableCell>
      <TableCell
        className={
          diff === 0
            ? "text-right tabular-nums text-emerald-600"
            : "text-right font-medium tabular-nums text-amber-600"
        }
      >
        {diff > 0 ? `+${diff}` : diff}
      </TableCell>
    </TableRow>
  )
}

function Distribucion({
  label,
  valor,
  ratio,
  total,
}: {
  label: string
  valor: number
  ratio: number | null
  total: number
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <dt>{label}</dt>
        <dd className="font-semibold tabular-nums">{formatPercent(ratio)}</dd>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(ratio ?? 0) * 100}%` }}
        />
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {formatNumber(valor)} ÷ {formatNumber(total)}
      </p>
    </div>
  )
}

/**
 * Las jornadas que registró el equipo, al lado de los días hábiles que tenía el
 * período. Va sin caja editable porque es un dato de la gestión diaria, pero
 * con el mismo peso: se leen como un par.
 */
function Registradas({ valor, comerciales }: { valor: number; comerciales: number }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        Jornadas registradas · {comerciales} comercial(es)
      </p>
      <p className="flex h-8 w-28 items-center justify-end rounded-lg border bg-muted/40 px-2.5 text-sm font-medium tabular-nums">
        {formatNumber(valor)}
      </p>
    </div>
  )
}

function Promedio({ label, valor }: { label: string; valor: number | null }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{valor === null ? "—" : formatNumber(Math.round(valor * 10) / 10)}</dd>
    </div>
  )
}

/** Cada columna de la hoja de gestión, en el mismo orden y con los mismos bloques. */
const COLUMNAS: { grupo: string; campos: { key: keyof FilaIndicadores; label: string; total?: boolean }[] }[] = [
  {
    grupo: "Jornada",
    campos: [
      { key: "dias_laborados", label: "Días" },
      { key: "dias_tarde", label: "Tarde" },
    ],
  },
  {
    grupo: "Llamadas",
    campos: [
      { key: "llamada_efectiva", label: "Efectiva" },
      { key: "llamada_seguimiento", label: "Seguim." },
      { key: "llamada_agenda", label: "Agenda" },
      { key: "llamada_no_interesado", label: "No int." },
      { key: "llamada_postventa", label: "Postv." },
      { key: "llamadas_contestadas", label: "Contest.", total: true },
      { key: "llamada_no_contestada", label: "No cont." },
      { key: "total_llamadas", label: "Total", total: true },
    ],
  },
  {
    grupo: "Agendas",
    campos: [
      { key: "agenda_confirmada", label: "Confirm." },
      { key: "agenda_posible", label: "Posible" },
      { key: "agenda_reprograma", label: "Reprog." },
      { key: "agenda_no_contesta", label: "No cont." },
      { key: "agenda_cancela", label: "Cancela" },
      { key: "total_agendas", label: "Total", total: true },
    ],
  },
  {
    grupo: "Atención presencial",
    campos: [
      { key: "atencion_venta", label: "Venta" },
      { key: "atencion_venta_externa", label: "Externa" },
      { key: "atencion_seguimiento", label: "Seguim." },
      { key: "atencion_declinado", label: "Declin." },
      { key: "total_atencion", label: "Total", total: true },
    ],
  },
  { grupo: "Agenda", campos: [{ key: "atencion_agenda", label: "Atendida" }] },
  {
    grupo: "Administrativa",
    campos: [
      { key: "atencion_asociado", label: "Asoc." },
      { key: "atencion_enrolamiento", label: "Enrol." },
      { key: "atencion_certificados", label: "Certif." },
      { key: "atencion_renovacion", label: "Renov." },
      { key: "total_administrativa", label: "Total", total: true },
    ],
  },
  {
    grupo: "Cola del CRM (chats · tareas · caducadas)",
    campos: [
      { key: "chats_inicial", label: "Ini." },
      { key: "chats_medio", label: "Medio" },
      { key: "chats_final", label: "Final" },
      { key: "tareas_inicial", label: "Ini." },
      { key: "tareas_medio", label: "Medio" },
      { key: "tareas_final", label: "Final" },
      { key: "caducadas_inicial", label: "Ini." },
      { key: "caducadas_medio", label: "Medio" },
      { key: "caducadas_final", label: "Final" },
    ],
  },
]

function TablaTotales({ filas, total }: { filas: FilaIndicadores[]; total: FilaIndicadores }) {
  const celda = (f: FilaIndicadores, key: keyof FilaIndicadores, destacada?: boolean) => (
    <TableCell
      key={String(key)}
      className={
        destacada
          ? "bg-muted/40 text-right font-medium tabular-nums"
          : "text-right tabular-nums"
      }
    >
      {formatNumber(Number(f[key] ?? 0))}
    </TableCell>
  )
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2} className="sticky left-0 bg-card">
            Comercial
          </TableHead>
          {COLUMNAS.map((g) => (
            <TableHead key={g.grupo} colSpan={g.campos.length} className="border-l text-center">
              {g.grupo}
            </TableHead>
          ))}
        </TableRow>
        <TableRow>
          {COLUMNAS.flatMap((g) =>
            g.campos.map((c, i) => (
              <TableHead
                key={`${g.grupo}-${String(c.key)}`}
                className={`text-right ${i === 0 ? "border-l" : ""} ${c.total ? "bg-muted/40" : ""}`}
              >
                {c.label}
              </TableHead>
            )),
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas
          .filter((f) => f.dias_laborados > 0)
          .map((f) => (
            <TableRow key={f.staff_id ?? "sin"}>
              <TableCell className="sticky left-0 max-w-40 truncate bg-card">{f.responsable_nombre}</TableCell>
              {COLUMNAS.flatMap((g) => g.campos.map((c) => celda(f, c.key, c.total)))}
            </TableRow>
          ))}
        <TableRow className="font-semibold">
          <TableCell className="sticky left-0 bg-card">Total</TableCell>
          {COLUMNAS.flatMap((g) => g.campos.map((c) => celda(total, c.key, c.total)))}
        </TableRow>
        {filas.every((f) => f.dias_laborados === 0) && (
          <TableRow>
            <TableCell colSpan={40} className="py-6 text-center text-sm text-muted-foreground">
              Sin jornadas registradas en el período.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
