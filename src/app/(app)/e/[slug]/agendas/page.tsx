import { CalendarCheck2, ExternalLink } from "lucide-react"
import { notFound } from "next/navigation"

import { ColasNav } from "@/components/agendas/colas-nav"
import { FilaAgenda } from "@/components/agendas/fila-agenda"
import { SincronizarKommo } from "@/components/kommo/sincronizar-kommo"
import { ModuleMissing } from "@/components/module-missing"
import { PageHeader } from "@/components/page-header"
import { RecordFilters } from "@/components/record-filters"
import { EmptyRow, RecordsScaffold } from "@/components/records-scaffold"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { estadoDe, hoyEnBogota, leerCola, type Cola } from "@/lib/agendas"
import { contarColas, historialDe, listarCola } from "@/lib/data/agendas"
import { construirHref, getCompanyContext, type CompanyContext } from "@/lib/data/company"
import { leerFiltros, listAppointments } from "@/lib/data/records"
import { formatDate } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

/**
 * Agendas: primero lo que hay que hacer hoy, y al final el histórico.
 *
 * La cita llega de Kommo y no se escribe acá (049). Lo que se escribe es la
 * gestión: a quién se llamó, qué dijo, si vino. Por eso la pantalla no abre en
 * una tabla de consulta sino en la cola del día: un listado ordenado por fecha
 * no dice por dónde empezar, y esa era justamente la pregunta.
 */
export default async function AgendasPage({
  params,
  searchParams,
}: PageProps<"/e/[slug]/agendas">) {
  const { slug } = await params
  const sp = await searchParams
  const company = await getCompanyContext(slug)
  if (!company) notFound()
  if (!company.modules.includes("agendas")) {
    return <ModuleMissing companySlug={slug} companyName={company.name} />
  }

  const cola = leerCola(sp.cola)
  const [conteos, kommo] = await Promise.all([contarColas(company.id), leerModoKommo(company)])

  const nav = <ColasNav base={`/e/${slug}/agendas`} actual={cola} conteos={conteos} />
  const acciones = kommo ? <SincronizarKommo companyId={company.id} /> : null

  if (cola === "historico") {
    return <Historico company={company} slug={slug} sp={sp} nav={nav} acciones={acciones} />
  }

  return <ColaDeTrabajo company={company} cola={cola} nav={nav} acciones={acciones} />
}

/** La fila de «Traer de Kommo» solo la ve quien administra: para un asesor no hay botón. */
async function leerModoKommo(company: CompanyContext): Promise<boolean> {
  if (!company.canManage) return false
  const supabase = await createClient()
  const { data } = await supabase
    .from("kommo_integrations")
    .select("config")
    .eq("company_id", company.id)
    .maybeSingle()
  return Boolean((data?.config as { modo?: string } | null)?.modo)
}

const TITULOS: Record<Exclude<Cola, "historico">, { titulo: string; descripcion: string; vacio: string }> = {
  hoy: {
    titulo: "Agendas",
    descripcion: "Las citas de hoy: primero las que nadie confirmó, después las que hay que marcar.",
    vacio: "No hay citas para hoy. Mira «Por validar» para adelantar las de los próximos días.",
  },
  validar: {
    titulo: "Agendas",
    descripcion: "Citas que todavía no llegan y a las que falta confirmarles la asistencia.",
    vacio: "Todas las citas próximas están validadas.",
  },
  seguimiento: {
    titulo: "Agendas",
    descripcion: `Clientes que no vinieron. Se les insiste hasta tres veces y después se sueltan.`,
    vacio: "Nadie quedó pendiente de seguimiento.",
  },
}

/**
 * Una cola de trabajo.
 *
 * No pagina: una cola con más de doscientos clientes ya no es una cola, y
 * partirla en páginas solo escondería el problema. Si eso pasa, lo que sobra
 * es gente sin llamar, no filas por pantalla.
 */
async function ColaDeTrabajo({
  company,
  cola,
  nav,
  acciones,
}: {
  company: CompanyContext
  cola: Exclude<Cola, "historico">
  nav: React.ReactNode
  acciones: React.ReactNode
}) {
  const filas = await listarCola(company.id, cola)
  const historial = await historialDe(filas.map((f) => f.id!).filter(Boolean))
  const hoy = hoyEnBogota()
  const texto = TITULOS[cola]

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={texto.titulo} description={texto.descripcion} actions={acciones} />
      {nav}

      {filas.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-16 text-center">
          <CalendarCheck2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{texto.vacio}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filas.map((fila) => (
            <FilaAgenda
              key={fila.id}
              fila={fila}
              historial={historial.get(fila.id!) ?? []}
              companyName={company.name}
              plantilla={company.agenda_recordatorio}
              hoy={hoy}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/** El listado de siempre: filtrable, paginado y de solo lectura. */
async function Historico({
  company,
  slug,
  sp,
  nav,
  acciones,
}: {
  company: CompanyContext
  slug: string
  sp: Record<string, string | string[] | undefined>
  nav: React.ReactNode
  acciones: React.ReactNode
}) {
  const pagina = await listAppointments(company.id, leerFiltros(sp))
  const filtrando = Object.entries(sp).some(([k, v]) => k !== "cola" && typeof v === "string" && v)

  return (
    <RecordsScaffold
      title="Agendas"
      description={`Todas las citas de ${company.name} y en qué terminaron. Se crean y se corrigen en Kommo.`}
      actions={acciones}
      filters={
        <>
          {nav}
          <RecordFilters
            sedes={company.branches}
            responsables={company.staff}
            buscar="Nombre o celular…"
          />
        </>
      }
      total={pagina.total}
      page={pagina.page}
      pageSize={pagina.pageSize}
      hrefPagina={(p) => construirHref(`/e/${slug}/agendas`, sp, p)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Fecha</TableHead>
            <TableHead className="w-20">Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="w-36">Celular</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead className="w-36">Estado</TableHead>
            <TableHead className="w-20 text-right">Llamadas</TableHead>
            <TableHead>Observación</TableHead>
            <TableHead className="w-32">Origen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.rows.map((a) => {
            const estado = estadoDe(a.estado_efectivo ?? "pendiente")
            return (
              <TableRow key={a.id}>
                <TableCell className="tabular-nums">
                  {a.scheduled_at ? formatDate(a.scheduled_at) : "—"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {a.scheduled_time?.slice(0, 5) ?? "—"}
                </TableCell>
                <TableCell className="max-w-56 truncate">{a.nombre ?? "—"}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {a.celular ?? "—"}
                </TableCell>
                <TableCell className="max-w-40 truncate text-sm">
                  {a.responsable_nombre ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge className={cn("border-transparent", estado.tono)}>{estado.label}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {a.intentos_validacion || "—"}
                </TableCell>
                <TableCell className="max-w-72 truncate text-xs text-muted-foreground">
                  {a.observacion ?? a.resultado ?? ""}
                </TableCell>
                <TableCell>
                  <Origen fila={a} />
                </TableCell>
              </TableRow>
            )
          })}

          {pagina.rows.length === 0 && <EmptyRow colSpan={9} filtrando={filtrando} />}
        </TableBody>
      </Table>
    </RecordsScaffold>
  )
}

const ORIGENES: Record<string, string> = { kommo: "Kommo", excel: "Excel", app: "App" }

/** De dónde salió la agenda. Las de Kommo llevan su id y abren el lead allá. */
function Origen({
  fila,
}: {
  fila: { source: string | null; external_lead_id: number | null; external_url: string | null }
}) {
  const nombre = ORIGENES[fila.source ?? ""] ?? fila.source ?? "—"
  if (fila.source !== "kommo" || !fila.external_url) {
    return (
      <Badge variant="secondary" className="text-[10px] font-normal">
        {nombre}
      </Badge>
    )
  }
  return (
    <a
      href={fila.external_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs tabular-nums hover:underline"
    >
      <Badge variant="outline" className="text-[10px] font-normal">
        {nombre}
      </Badge>
      #{fila.external_lead_id}
      <ExternalLink className="size-3" />
    </a>
  )
}
