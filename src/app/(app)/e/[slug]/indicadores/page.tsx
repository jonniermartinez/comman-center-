import { notFound } from "next/navigation"

import { DiasHabiles } from "@/components/indicadores/dias-habiles"
import { InversionPauta } from "@/components/indicadores/inversion-pauta"
import { RentabilidadPauta } from "@/components/indicadores/rentabilidad-pauta"
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
import { cn } from "@/lib/utils"
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
  const kpis = kpisDe(total, datos.diasHabiles, conJornada, datos.metas)
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

      {/* ============ Rentabilidad de la pauta ============ */}
      <SectionCard className="mb-4">
        <SectionCardHeader
          title="Rentabilidad de la pauta"
          description={`ROAS = facturación ÷ inversión en pauta; costo por venta = inversión ÷ ventas. La facturación y las ventas salen de la base; la inversión la anota quien administra con el acumulado de cada mes.${
            meses.length > 1 ? " En un rango de varios meses se suma la inversión de los meses que toca." : ""
          }`}
        />
        <RentabilidadPauta
          facturacion={facturacionTotal(total)}
          ventas={total.ventas_total}
          inversion={datos.inversion}
        />
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
          {meses.slice(0, 3).map((m) => (
            <InversionPauta
              key={m}
              companyId={company.id}
              mes={m}
              valor={datos.inversionPorMes.find((p) => p.period_month === m)?.monto ?? null}
              editable={company.canManage}
            />
          ))}
          {!company.canManage && (
            <p className="pb-2 text-xs text-muted-foreground">
              La inversión la actualiza quien administra la empresa.
            </p>
          )}
        </div>
      </SectionCard>

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
            title="Distribución de ventas por canal"
            description="Ventas presenciales ÷ total de ventas y digitales ÷ total. Los dos suman 100 %, así que van sin meta y sin semáforo: es un reparto, no un objetivo."
          />
          <Reparto
            presencial={reparto.presencial.ratio}
            digital={reparto.digital.ratio}
            total={reparto.conTipo}
          />
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <Distribucion
              label="Presencial"
              tono="sky"
              valor={reparto.presencial.cantidad}
              ratio={reparto.presencial.ratio}
              total={reparto.conTipo}
            />
            <Distribucion
              label="Digital"
              tono="violet"
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
          description={`Meta, logrado y efectividad (logrado ÷ meta), sobre los totales del filtro. Verde cumple, ámbar está cerca, rojo está lejos o el dato es imposible. No todos se leen igual: unos se empujan sin techo, en otros pasar del 100 % delata un error de captura, y venta presencial y seguimiento tienen un óptimo del que también se puede uno pasar.${
            company.canManage ? " La meta de cada indicador se cambia en su tarjeta; vacía vuelve a la de por defecto." : ""
          }`}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => (
            <KpiCard key={k.code} kpi={k} companyId={company.id} editable={company.canManage} />
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

/** Los dos canales en una sola barra apilada: el reparto se ve de un vistazo. */
function Reparto({
  presencial,
  digital,
  total,
}: {
  presencial: number | null
  digital: number | null
  total: number
}) {
  if (!total) {
    return (
      <div className="flex h-8 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
        Sin ventas con tipo en el período
      </div>
    )
  }
  const p = (presencial ?? 0) * 100
  const d = (digital ?? 0) * 100
  return (
    <div
      className="flex h-8 w-full overflow-hidden rounded-lg text-xs font-semibold text-white"
      role="img"
      aria-label={`${formatPercent(presencial)} presencial, ${formatPercent(digital)} digital`}
    >
      {p > 0 && (
        <div className="flex items-center justify-center bg-sky-600" style={{ width: `${p}%` }}>
          {p >= 12 && formatPercent(presencial)}
        </div>
      )}
      {d > 0 && (
        <div className="flex items-center justify-center bg-violet-600" style={{ width: `${d}%` }}>
          {d >= 12 && formatPercent(digital)}
        </div>
      )}
    </div>
  )
}

function Distribucion({
  label,
  tono,
  valor,
  ratio,
  total,
}: {
  label: string
  tono: "sky" | "violet"
  valor: number
  ratio: number | null
  total: number
}) {
  const colores = {
    sky: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-100",
  }
  return (
    <div className={`rounded-lg border px-3 py-2 ${colores[tono]}`}>
      <dt className="text-xs font-medium">{label}</dt>
      <dd className="text-2xl font-bold leading-8 tabular-nums">{formatPercent(ratio)}</dd>
      <p className="text-xs tabular-nums opacity-80">
        {formatNumber(valor)} de {formatNumber(total)} ventas
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

type Campo = { key: keyof FilaIndicadores; label: string; total?: boolean }

/** Los colores de los bloques, los mismos del formulario de la jornada. */
type TonoBloque = "sky" | "emerald" | "amber" | "violet" | "slate"

const ENCABEZADO: Record<TonoBloque, string> = {
  sky: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100",
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100",
  amber:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100",
  violet:
    "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-100",
  slate: "border-border bg-muted/40 text-foreground",
}

/** El lavado suave del mismo tono, para las celdas de datos del bloque. */
const CELDA: Record<TonoBloque, string> = {
  sky: "bg-sky-50/40 dark:bg-sky-950/20",
  emerald: "bg-emerald-50/40 dark:bg-emerald-950/20",
  amber: "bg-amber-50/40 dark:bg-amber-950/20",
  violet: "bg-violet-50/40 dark:bg-violet-950/20",
  slate: "",
}

/**
 * Cada columna de la hoja de gestión, en el mismo orden, con los mismos
 * bloques y los mismos colores que el formulario de la jornada, para que la
 * tabla se lea como el Excel. Un bloque puede traer sub-bloques con nombre: la
 * cola del CRM son tres tríos (chats, tareas, caducadas) que sin su título se
 * leían como "inicial, medio, final" repetido tres veces sin saber cuál era cuál.
 */
const COLUMNAS: { grupo: string; tono: TonoBloque; bloques: { nombre?: string; campos: Campo[] }[] }[] = [
  {
    grupo: "Jornada",
    tono: "slate",
    bloques: [{ campos: [
      { key: "dias_laborados", label: "Días" },
      { key: "dias_tarde", label: "Tarde" },
    ] }],
  },
  {
    grupo: "Llamadas",
    tono: "sky",
    bloques: [{ campos: [
      { key: "llamada_efectiva", label: "Efectiva" },
      { key: "llamada_seguimiento", label: "Seguim." },
      { key: "llamada_agenda", label: "Agenda" },
      { key: "llamada_no_interesado", label: "No int." },
      { key: "llamada_postventa", label: "Postv." },
      { key: "llamadas_contestadas", label: "Contest.", total: true },
      { key: "llamada_no_contestada", label: "No cont." },
      { key: "total_llamadas", label: "Total", total: true },
    ] }],
  },
  {
    grupo: "Agendas",
    tono: "emerald",
    bloques: [{ campos: [
      { key: "agenda_confirmada", label: "Confirm." },
      { key: "agenda_posible", label: "Posible" },
      { key: "agenda_reprograma", label: "Reprog." },
      { key: "agenda_no_contesta", label: "No cont." },
      { key: "agenda_cancela", label: "Cancela" },
      { key: "total_agendas", label: "Total", total: true },
    ] }],
  },
  {
    grupo: "Atención presencial",
    tono: "amber",
    bloques: [
      {
        nombre: "Venta presencial",
        campos: [
          { key: "atencion_venta", label: "Venta" },
          { key: "atencion_venta_externa", label: "Externa" },
          { key: "atencion_seguimiento", label: "Seguim." },
          { key: "atencion_declinado", label: "Declin." },
          { key: "total_atencion", label: "Total", total: true },
        ],
      },
      { nombre: "Agenda", campos: [{ key: "atencion_agenda", label: "Atendida" }] },
      {
        nombre: "Administrativa",
        campos: [
          { key: "atencion_asociado", label: "Asoc." },
          { key: "atencion_enrolamiento", label: "Enrol." },
          { key: "atencion_certificados", label: "Certif." },
          { key: "atencion_renovacion", label: "Renov." },
          { key: "total_administrativa", label: "Total", total: true },
        ],
      },
    ],
  },
  {
    grupo: "Cola del CRM",
    tono: "violet",
    bloques: [
      {
        nombre: "Chats",
        campos: [
          { key: "chats_inicial", label: "Inicial" },
          { key: "chats_medio", label: "Medio día" },
          { key: "chats_final", label: "Final" },
        ],
      },
      {
        nombre: "Tareas",
        campos: [
          { key: "tareas_inicial", label: "Inicial" },
          { key: "tareas_medio", label: "Medio día" },
          { key: "tareas_final", label: "Final" },
        ],
      },
      {
        nombre: "Caducadas",
        campos: [
          { key: "caducadas_inicial", label: "Inicial" },
          { key: "caducadas_medio", label: "Medio día" },
          { key: "caducadas_final", label: "Final" },
        ],
      },
    ],
  },
]

function TablaTotales({ filas, total }: { filas: FilaIndicadores[]; total: FilaIndicadores }) {
  const columnas = COLUMNAS.flatMap((g) =>
    g.bloques.flatMap((b, bi) =>
      b.campos.map((c, ci) => ({
        ...c,
        tono: g.tono,
        // La primera columna de cada bloque lleva borde: separa los grupos.
        borde: bi === 0 && ci === 0 ? "border-l-2" : ci === 0 ? "border-l" : "",
      })),
    ),
  )
  const conSubBloques = COLUMNAS.some((g) => g.bloques.some((b) => b.nombre))

  const celda = (f: FilaIndicadores, col: (typeof columnas)[number]) => (
    <TableCell
      key={String(col.key)}
      className={cn(
        "text-right tabular-nums",
        col.borde,
        col.total ? "font-medium bg-muted/50" : CELDA[col.tono],
      )}
    >
      {formatNumber(Number(f[col.key] ?? 0))}
    </TableCell>
  )

  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow className="border-b-0">
          <TableHead rowSpan={conSubBloques ? 3 : 2} className="sticky left-0 bg-card align-bottom">
            Comercial
          </TableHead>
          {COLUMNAS.map((g) => {
            const ancho = g.bloques.reduce((n, b) => n + b.campos.length, 0)
            const sinSub = g.bloques.every((b) => !b.nombre)
            return (
              <TableHead
                key={g.grupo}
                colSpan={ancho}
                rowSpan={conSubBloques && sinSub ? 2 : 1}
                className={cn("border-l-2 border-b text-center font-semibold", ENCABEZADO[g.tono])}
              >
                {g.grupo}
              </TableHead>
            )
          })}
        </TableRow>
        {conSubBloques && (
          <TableRow className="border-b-0">
            {COLUMNAS.flatMap((g) =>
              g.bloques.every((b) => !b.nombre)
                ? []
                : g.bloques.map((b, bi) => (
                    <TableHead
                      key={`${g.grupo}-${b.nombre}`}
                      colSpan={b.campos.length}
                      className={cn(
                        "border-b text-center font-medium",
                        bi === 0 ? "border-l-2" : "border-l",
                        ENCABEZADO[g.tono],
                      )}
                    >
                      {b.nombre}
                    </TableHead>
                  )),
            )}
          </TableRow>
        )}
        <TableRow>
          {columnas.map((c) => (
            <TableHead
              key={String(c.key)}
              className={cn(
                "text-right",
                c.borde,
                c.total ? "bg-muted/50 font-medium" : CELDA[c.tono],
              )}
            >
              {c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas
          .filter((f) => f.dias_laborados > 0)
          .map((f) => (
            <TableRow key={f.staff_id ?? "sin"}>
              <TableCell className="sticky left-0 max-w-40 truncate bg-card">{f.responsable_nombre}</TableCell>
              {columnas.map((c) => celda(f, c))}
            </TableRow>
          ))}
        <TableRow className="font-semibold">
          <TableCell className="sticky left-0 bg-card">Total</TableCell>
          {columnas.map((c) => celda(total, c))}
        </TableRow>
        {filas.every((f) => f.dias_laborados === 0) && (
          <TableRow>
            <TableCell colSpan={columnas.length + 1} className="py-6 text-center text-sm text-muted-foreground">
              Sin jornadas registradas en el período.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
