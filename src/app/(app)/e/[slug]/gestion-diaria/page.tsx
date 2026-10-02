import { ChevronRight, Timer } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { NuevaJornada, type JornadaExistente } from "@/components/captura/nueva-jornada"
import { ModuleMissing } from "@/components/module-missing"
import { RecordFilters } from "@/components/record-filters"
import { EmptyRow, RecordsScaffold } from "@/components/records-scaffold"
import { StatStrip } from "@/components/stat-strip"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { construirHref, getCompanyContext } from "@/lib/data/company"
import { leerFiltros, listActivity, type ActivityRow } from "@/lib/data/records"
import { formatDate, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

type Fila = ActivityRow

interface Columna {
  key: string
  label: string
  /** Nombre completo, para el tooltip del encabezado abreviado. */
  titulo?: string
  total?: boolean
  render: (r: Fila) => React.ReactNode
}

/** Un conteo: el cero se atenúa para que lo que sí pasó salte a la vista. */
function conteo(campo: keyof Fila, opciones: Partial<Columna> & { label: string }): Columna {
  return {
    key: campo,
    ...opciones,
    render: (r) => {
      const n = Number(r[campo] ?? 0)
      return n === 0 ? <span className="text-muted-foreground/50">0</span> : n
    },
  }
}

const DEPURADOS = {
  chats: "chats_depurados",
  tareas: "tareas_depuradas",
  caducadas: "caducadas_depuradas",
} as const

/** La cola del CRM en sus tres momentos: inicial › medio › final. */
function cola(prefijo: "chats" | "tareas" | "caducadas", label: string): Columna {
  return {
    key: prefijo,
    label,
    titulo: `${label}: inicial › medio › final`,
    render: (r) => {
      const depurados = Number(r[DEPURADOS[prefijo]] ?? 0)
      return (
        <span className="inline-flex items-center gap-1">
          <span>{r[`${prefijo}_inicial`]}</span>
          <ChevronRight className="size-3 text-muted-foreground/60" />
          <span className="text-muted-foreground">{r[`${prefijo}_medio`]}</span>
          <ChevronRight className="size-3 text-muted-foreground/60" />
          <span className={depurados > 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}>
            {r[`${prefijo}_final`]}
          </span>
        </span>
      )
    },
  }
}

function ratio(campo: keyof Fila, label: string, titulo: string): Columna {
  return {
    key: campo,
    label,
    titulo,
    render: (r) => (
      <span className="text-muted-foreground">
        {formatPercent(r[campo] === null ? null : Number(r[campo]))}
      </span>
    ),
  }
}

/** Mismos bloques y colores que el formulario de la jornada. */
const GRUPOS: { titulo: string; tono: keyof typeof TONOS; columnas: Columna[] }[] = [
  {
    titulo: "Llamadas",
    tono: "sky",
    columnas: [
      conteo("llamada_efectiva", { label: "Efectiva", titulo: "Efectiva (venta digital)" }),
      conteo("llamada_seguimiento", { label: "Seguim.", titulo: "Seguimiento" }),
      conteo("llamada_agenda", { label: "Agenda" }),
      conteo("llamada_no_interesado", { label: "No int.", titulo: "No interesado" }),
      conteo("llamada_postventa", { label: "Postventa" }),
      conteo("llamadas_contestadas", { label: "Contest.", titulo: "Contestadas", total: true }),
      conteo("llamada_no_contestada", { label: "No contest.", titulo: "No contestadas" }),
      conteo("total_llamadas", { label: "Total", titulo: "Total de llamadas", total: true }),
    ],
  },
  {
    titulo: "Agendas",
    tono: "emerald",
    columnas: [
      conteo("agenda_confirmada", { label: "Confirm.", titulo: "Confirmada" }),
      conteo("agenda_posible", { label: "Posible", titulo: "Posible asistencia" }),
      conteo("agenda_reprograma", { label: "Reprog.", titulo: "Reprograma" }),
      conteo("agenda_no_contesta", { label: "No contesta" }),
      conteo("agenda_cancela", { label: "Cancela" }),
      conteo("total_agendas", { label: "Total", titulo: "Total de agendas", total: true }),
    ],
  },
  {
    titulo: "Validaciones",
    tono: "rose",
    columnas: [
      conteo("validacion_confirmada", { label: "Confirm.", titulo: "Validación confirmada" }),
      conteo("validacion_posible", { label: "Posible", titulo: "Posible asistencia" }),
      conteo("validacion_reprograma", { label: "Reprog.", titulo: "Reprograma" }),
      conteo("validacion_no_contesta", { label: "No contesta" }),
      conteo("validacion_cancela", { label: "Cancela" }),
      conteo("total_validaciones", { label: "Total", titulo: "Total de validaciones", total: true }),
    ],
  },
  {
    titulo: "Atención presencial",
    tono: "amber",
    columnas: [
      conteo("atencion_venta", { label: "Venta", titulo: "Venta exitosa" }),
      conteo("atencion_venta_externa", { label: "Externa", titulo: "Venta externa" }),
      conteo("atencion_seguimiento", { label: "Seguim.", titulo: "Seguimiento" }),
      conteo("atencion_declinado", { label: "Declinado" }),
      conteo("total_atencion", { label: "Total", titulo: "Total atención presencial", total: true }),
      conteo("atencion_agenda", { label: "De agenda", titulo: "Agenda atendida (no suma al total)" }),
    ],
  },
  {
    titulo: "Administrativa",
    tono: "violet",
    columnas: [
      conteo("atencion_asociado", { label: "Asociado" }),
      conteo("atencion_enrolamiento", { label: "Enrol.", titulo: "Enrolamiento" }),
      conteo("atencion_certificados", { label: "Certif.", titulo: "Certificados" }),
      conteo("atencion_renovacion", { label: "Renov.", titulo: "Renovaciones" }),
      conteo("total_administrativa", { label: "Total", titulo: "Total administrativa", total: true }),
    ],
  },
  {
    titulo: "Cola del CRM",
    tono: "slate",
    columnas: [cola("chats", "Chats"), cola("tareas", "Tareas"), cola("caducadas", "Caducadas")],
  },
  {
    titulo: "Indicadores",
    tono: "rose",
    columnas: [
      ratio("ratio_contactabilidad", "Contactab.", "Contactabilidad: contestadas / total de llamadas"),
      ratio("ratio_conversion_llamada", "Conv. llamada", "Efectivas / total de llamadas"),
      ratio("volumen_venta_general", "Venta/contest.", "Efectivas / llamadas contestadas"),
      ratio("ratio_conversion_agendas", "Conv. agendas", "Agendas atendidas / total de agendas"),
      ratio("ratio_venta_presencial", "Venta presencial", "Conversión de la atención presencial"),
    ],
  },
]

const TONOS = {
  sky: "bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  emerald: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  violet: "bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  rose: "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
}

// Fecha, responsable y el lápiz quedan fijos mientras la tabla se desplaza
// de lado; necesitan fondo propio para tapar lo que pasa por debajo.
const FIJA_1 = "sticky left-0 z-10 min-w-24"
const FIJA_2 = "sticky left-24 z-10 border-r"
const FIJA_DER = "sticky right-0 z-10 border-l"
const CELDA_FIJA = "bg-card group-hover:bg-muted"
const BORDE = "border-l"

const TOTAL_COLUMNAS = 4 + GRUPOS.reduce((a, g) => a + g.columnas.length, 0) + 2

/**
 * Gestión diaria: una fila por persona y día.
 *
 * En el Excel esto era una sola hoja con la jornada, la cola del CRM en tres
 * momentos, las agendas, las llamadas y las atenciones. Antes la app lo partía
 * en dos formularios ("KPI Diario" y "Gestión Diaria") que en realidad eran
 * columnas de la misma fila.
 */
export default async function GestionDiariaPage({
  params,
  searchParams,
}: PageProps<"/e/[slug]/gestion-diaria">) {
  const { slug } = await params
  const sp = await searchParams
  const company = await getCompanyContext(slug)
  if (!company) notFound()
  if (!company.modules.includes("actividad_diaria")) {
    return <ModuleMissing companySlug={slug} companyName={company.name} />
  }

  const pagina = await listActivity(company.id, leerFiltros(sp))
  const tarde = pagina.rows.filter((r) => r.llego_tarde).length
  const conHora = pagina.rows.filter((r) => r.hora_llegada).length
  const filtrando = Object.values(sp).some((v) => typeof v === "string" && v)

  return (
    <RecordsScaffold
      title="Gestión Diaria"
      description={`Jornada, cola del CRM, agendas, llamadas y atenciones de ${company.name}. Se espera al equipo a las ${company.hora_entrada.slice(0, 5)}.`}
      actions={
        <>
          {/* La jornada se registra mientras pasa; esta tabla es para mirarla
              después. El enlace está acá porque es donde la gente llega. */}
          <Button asChild variant="outline">
            <Link href={`/e/${slug}/mi-jornada`}>
              <Timer className="size-4" />
              Mi jornada
            </Link>
          </Button>
          <NuevaJornada
          companyId={company.id}
          branches={company.branches}
          staff={company.staff}
          horaEntrada={company.hora_entrada}
          canManage={company.canManage}
          myStaffId={company.myStaffId}
        />
        </>
      }
      filters={<RecordFilters sedes={company.branches} responsables={company.staff} buscar="Responsable…" />}
      summary={
        <StatStrip
          className="mb-4"
          items={[
            { label: "Jornadas registradas", value: pagina.total, unit: "cantidad" },
            {
              label: "Llegadas tarde (página)",
              value: tarde,
              unit: "cantidad",
              hint: conHora ? `de ${conHora} con hora registrada` : "sin horas registradas",
            },
            {
              label: "Llamadas (página)",
              value: pagina.rows.reduce((a, r) => a + Number(r.total_llamadas ?? 0), 0),
              unit: "cantidad",
            },
            {
              label: "Ventas por llamada (página)",
              value: pagina.rows.reduce((a, r) => a + Number(r.llamada_efectiva ?? 0), 0),
              unit: "cantidad",
            },
          ]}
        />
      }
      total={pagina.total}
      page={pagina.page}
      pageSize={pagina.pageSize}
      hrefPagina={(p) => construirHref(`/e/${slug}/gestion-diaria`, sp, p)}
    >
      <Table className="text-[13px]">
        <TableHeader>
          {/* Fila de grupos: los mismos bloques de color del formulario. */}
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead colSpan={2} className={cn(FIJA_1, "h-8 bg-card")} />
            <TableHead colSpan={2} className="h-8" />
            {GRUPOS.map((g) => (
              <TableHead key={g.titulo} colSpan={g.columnas.length} className={cn("h-8 px-1 pt-2 pb-0", g !== GRUPOS[0] && BORDE)}>
                <span className={cn("block rounded-md px-2 py-1 text-center text-[11px] font-semibold tracking-wide uppercase", TONOS[g.tono])}>
                  {g.titulo}
                </span>
              </TableHead>
            ))}
            <TableHead colSpan={2} className={cn("h-8", BORDE)} />
          </TableRow>
          <TableRow className="text-xs hover:bg-transparent">
            <TableHead className={cn(FIJA_1, "w-24 bg-card")}>Fecha</TableHead>
            <TableHead className={cn(FIJA_2, "bg-card")}>Responsable</TableHead>
            <TableHead>Llegada</TableHead>
            <TableHead>Salida</TableHead>
            {GRUPOS.flatMap((g) =>
              g.columnas.map((c, i) => (
                <TableHead
                  key={c.key}
                  title={c.titulo}
                  className={cn(
                    "text-right text-muted-foreground",
                    i === 0 && g !== GRUPOS[0] && BORDE,
                    c.total && "text-foreground",
                  )}
                >
                  {c.label}
                </TableHead>
              )),
            )}
            <TableHead className={cn("min-w-40", BORDE)}>Notas</TableHead>
            <TableHead className={cn(FIJA_DER, "w-10 bg-card")} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.rows.map((r) => (
            <TableRow key={r.id} className="group">
              <TableCell className={cn(FIJA_1, CELDA_FIJA, "tabular-nums")}>
                {formatDate(r.report_date!)}
              </TableCell>
              <TableCell className={cn(FIJA_2, CELDA_FIJA, "max-w-44 truncate font-medium")}>
                {r.responsable_nombre}
              </TableCell>
              <TableCell>
                {r.hora_llegada ? (
                  <Badge
                    variant={r.llego_tarde ? "destructive" : "outline"}
                    className="text-[10px] tabular-nums"
                  >
                    {r.hora_llegada.slice(0, 5)}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {r.hora_salida ? r.hora_salida.slice(0, 5) : "—"}
              </TableCell>
              {GRUPOS.flatMap((g) =>
                g.columnas.map((c, i) => (
                  <TableCell
                    key={c.key}
                    className={cn(
                      "text-right tabular-nums",
                      i === 0 && g !== GRUPOS[0] && BORDE,
                      c.total && "bg-muted/40 font-semibold",
                    )}
                  >
                    {c.render(r)}
                  </TableCell>
                )),
              )}
              <TableCell
                className={cn("max-w-56 truncate text-xs text-muted-foreground", BORDE)}
                title={r.notas ?? undefined}
              >
                {r.notas || "—"}
              </TableCell>
              <TableCell className={cn(FIJA_DER, CELDA_FIJA)}>
                <NuevaJornada
                  companyId={company.id}
                  branches={company.branches}
                  staff={company.staff}
                  horaEntrada={company.hora_entrada}
                  canManage={company.canManage}
                  myStaffId={company.myStaffId}
                  registro={r as unknown as JornadaExistente}
                />
              </TableCell>
            </TableRow>
          ))}

          {pagina.rows.length === 0 && <EmptyRow colSpan={TOTAL_COLUMNAS} filtrando={filtrando} />}
        </TableBody>
      </Table>
    </RecordsScaffold>
  )
}
