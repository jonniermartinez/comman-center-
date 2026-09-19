import { Clock, TableProperties } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { IniciarJornada } from "@/components/jornada/iniciar-jornada"
import { PanelJornada } from "@/components/jornada/panel-jornada"
import { ModuleMissing } from "@/components/module-missing"
import { PageHeader } from "@/components/page-header"
import { SectionCard } from "@/components/section-card"
import { Button } from "@/components/ui/button"
import { getCompanyContext } from "@/lib/data/company"
import { miJornadaDeHoy, misJornadas } from "@/lib/data/mi-jornada"
import { duracionCorta, hms } from "@/lib/mi-jornada"
import { formatDate } from "@/lib/format"

/**
 * Mi jornada: la herramienta de trabajo, no el listado.
 *
 * Gestión Diaria pide treinta contadores al final del día y nadie se acuerda
 * de treinta cosas a las seis de la tarde. Acá se tipifica la llamada al
 * colgar —dos toques— y esos treinta números se llenan solos. Es la misma fila
 * de siempre; lo que cambia es quién la escribe.
 *
 * Por eso vive en su propia ruta y no dentro del listado: una se usa cien
 * veces al día con el teléfono en la mano, la otra se abre para consultar.
 */
export default async function MiJornadaPage({ params }: PageProps<"/e/[slug]/mi-jornada">) {
  const { slug } = await params
  const company = await getCompanyContext(slug)
  if (!company) notFound()
  if (!company.modules.includes("actividad_diaria")) {
    return <ModuleMissing companySlug={slug} companyName={company.name} />
  }

  const enlaceListado = (
    <Button asChild variant="outline">
      <Link href={`/e/${slug}/gestion-diaria`}>
        <TableProperties className="size-4" />
        Ver Gestión Diaria
      </Link>
    </Button>
  )

  // Sin persona del equipo enlazada no hay jornada que abrir: la cuenta existe
  // pero el sistema no sabe cuál de los comerciales es, y registrar a nombre de
  // nadie no tendría sentido.
  if (!company.myStaffId) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Mi jornada" description={company.name} actions={enlaceListado} />
        <SectionCard className="py-14 text-center">
          <Clock className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Tu cuenta no está enlazada a nadie del equipo</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Para registrar una jornada, quien coordina {company.name} tiene que enlazar tu
            cuenta con tu ficha en el equipo.
          </p>
        </SectionCard>
      </div>
    )
  }

  const jornada = await miJornadaDeHoy(company.id, company.myStaffId)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Mi jornada"
        description={
          jornada
            ? "Tipifica cada llamada al colgar. Los contadores del día se llenan solos."
            : `Hoy en ${company.name}. Al iniciar, empieza a correr el cronómetro.`
        }
        actions={enlaceListado}
      />

      {jornada ? (
        <PanelJornada
          jornada={jornada}
          companyId={company.id}
          horaEntrada={company.hora_entrada}
        />
      ) : (
        <>
          <SectionCard className="py-12 text-center">
            <Clock className="mx-auto mb-4 size-8 text-muted-foreground" />
            <p className="mb-1 font-medium">Todavía no has iniciado tu jornada</p>
            <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
              Al iniciar arranca el cronómetro y puedes empezar a tipificar tus llamadas. La hora
              de llegada queda registrada sola.
            </p>
            <IniciarJornada
              companyId={company.id}
              staffId={company.myStaffId}
              branches={company.branches}
            />
          </SectionCard>

          <Historial companyId={company.id} staffId={company.myStaffId} />
        </>
      )}
    </div>
  )
}

/** Las jornadas anteriores: cuánto se trabajó y cuánto de eso fue efectivo. */
async function Historial({ companyId, staffId }: { companyId: string; staffId: string }) {
  const jornadas = (await misJornadas(companyId, staffId)).filter((j) => j.fin)
  if (jornadas.length === 0) return null

  return (
    <SectionCard className="mt-4">
      <h2 className="mb-4 text-base font-medium">Tus jornadas anteriores</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 text-left font-medium">Día</th>
              <th className="py-2 text-right font-medium">Laborado</th>
              <th className="py-2 text-right font-medium">Efectivo</th>
              <th className="py-2 text-right font-medium">Llamadas</th>
              <th className="py-2 text-right font-medium">Promedio</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jornadas.map((j) => (
              <tr key={j.id}>
                <td className="py-2 tabular-nums">{formatDate(j.report_date!)}</td>
                <td className="py-2 text-right tabular-nums">{hms(Number(j.laborado_ms ?? 0))}</td>
                <td className="py-2 text-right tabular-nums">{hms(Number(j.efectivo_ms ?? 0))}</td>
                <td className="py-2 text-right tabular-nums">{j.llamadas ?? 0}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {duracionCorta(Number(j.promedio_llamada_ms ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
