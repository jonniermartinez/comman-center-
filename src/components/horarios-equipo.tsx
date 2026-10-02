"use client"

import { Clock } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { SectionCard, SectionCardHeader } from "@/components/section-card"
import { Input } from "@/components/ui/input"
import { listStaffSchedules, setStaffSchedule } from "@/lib/data/staff-actions"

type Fila = { staffId: string; nombre: string; entrada: string | null; salida: string | null }

/**
 * El horario de cada comercial.
 *
 * La empresa tiene una hora de entrada, pero no todos entran a esa hora:
 * contra la de cada persona se decide si llegó tarde (058). Vacío significa
 * "el horario de la empresa". Se guarda al salir del campo.
 */
export function HorariosEquipo({
  companyId,
  horaEmpresa,
  editable,
}: {
  companyId: string
  /** La hora de entrada de la empresa, la que aplica a quien no tenga la suya. */
  horaEmpresa: string
  editable: boolean
}) {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [pendiente, startTransition] = useTransition()

  useEffect(() => {
    let vigente = true
    listStaffSchedules(companyId).then((lista) => {
      if (vigente) setFilas(lista)
    })
    return () => {
      vigente = false
    }
  }, [companyId])

  function guardar(f: Fila, campo: "hora_entrada" | "hora_salida", valor: string) {
    const nuevo = valor || null
    const actual = (campo === "hora_entrada" ? f.entrada : f.salida)?.slice(0, 5) ?? null
    if (nuevo === actual) return
    startTransition(async () => {
      const r = await setStaffSchedule(companyId, f.staffId, campo, nuevo)
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo guardar el horario.")
        return
      }
      toast.success(
        nuevo
          ? `${f.nombre}: ${campo === "hora_entrada" ? "entra" : "sale"} a las ${nuevo}`
          : `${f.nombre}: vuelve al horario de la empresa`,
      )
      setFilas(await listStaffSchedules(companyId))
    })
  }

  return (
    <SectionCard className="mt-4">
      <SectionCardHeader
        icon={Clock}
        title="Horario de cada comercial"
        description={`La hora de entrada es contra la que se marca "tarde". Sin hora propia aplica la de la empresa (${horaEmpresa.slice(0, 5)}).`}
      />
      {filas === null ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay comerciales en el equipo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-2 text-left font-medium">Comercial</th>
                <th className="w-40 py-2 text-left font-medium">Hora de entrada</th>
                <th className="w-40 py-2 text-left font-medium">Hora de salida</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map((f) => (
                <tr key={f.staffId}>
                  <td className="py-2 pr-3">{f.nombre}</td>
                  {(["hora_entrada", "hora_salida"] as const).map((campo) => {
                    const valor = (campo === "hora_entrada" ? f.entrada : f.salida)?.slice(0, 5) ?? ""
                    return (
                      <td key={campo} className="py-2 pr-3">
                        <Input
                          // La clave incluye el valor: al recargar la lista el campo
                          // toma lo que quedó guardado.
                          key={`${f.staffId}-${campo}-${valor}`}
                          type="time"
                          defaultValue={valor}
                          disabled={!editable || pendiente}
                          aria-label={`${campo === "hora_entrada" ? "Hora de entrada" : "Hora de salida"} de ${f.nombre}`}
                          onBlur={(e) => guardar(f, campo, e.target.value)}
                          className="w-32"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}
