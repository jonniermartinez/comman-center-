"use client"

import { ChevronDown, ChevronRight, Clock } from "lucide-react"
import { Fragment, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { SectionCard, SectionCardHeader } from "@/components/section-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  listStaffSchedules,
  setStaffDaySchedule,
  setStaffSchedule,
  type HorarioDia,
} from "@/lib/data/staff-actions"

type Fila = {
  staffId: string
  nombre: string
  entrada: string | null
  salida: string | null
  dias: HorarioDia[]
}
type Campo = "hora_entrada" | "hora_salida"

/** 1 = lunes … 7 = domingo, como `isodow` en la base. */
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const hhmm = (h: string | null | undefined) => h?.slice(0, 5) ?? ""

/**
 * El horario de cada comercial.
 *
 * La empresa tiene una hora de entrada, pero no todos entran a esa hora:
 * contra la de cada persona se decide si llegó tarde (058). Y tampoco entran
 * igual toda la semana: cada día puede tener su propia hora (064). Lo que
 * quede vacío hereda: el día toma la general de la persona, y la persona la
 * de la empresa. Se guarda al salir del campo.
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
  const [abierta, setAbierta] = useState<string | null>(null)
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

  function guardar(f: Fila, campo: Campo, valor: string) {
    const nuevo = valor || null
    const actual = hhmm(campo === "hora_entrada" ? f.entrada : f.salida) || null
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

  function guardarDia(f: Fila, dia: number, campo: Campo, valor: string) {
    const nuevo = valor || null
    const d = f.dias.find((x) => x.dia === dia)
    const actual = hhmm(campo === "hora_entrada" ? d?.entrada : d?.salida) || null
    if (nuevo === actual) return
    const nombreDia = DIAS[dia - 1].toLowerCase()
    startTransition(async () => {
      const r = await setStaffDaySchedule(companyId, f.staffId, dia, campo, nuevo)
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo guardar el horario.")
        return
      }
      toast.success(
        nuevo
          ? `${f.nombre}: el ${nombreDia} ${campo === "hora_entrada" ? "entra" : "sale"} a las ${nuevo}`
          : `${f.nombre}: el ${nombreDia} vuelve a su horario general`,
      )
      setFilas(await listStaffSchedules(companyId))
    })
  }

  function campoHora(
    clave: string,
    valor: string,
    placeholder: string,
    etiqueta: string,
    onGuardar: (v: string) => void,
  ) {
    return (
      <Input
        // La clave incluye el valor: al recargar la lista el campo toma lo
        // que quedó guardado.
        key={`${clave}-${valor}`}
        type="time"
        defaultValue={valor}
        disabled={!editable || pendiente}
        aria-label={etiqueta}
        title={valor ? undefined : `Vacío: ${placeholder}`}
        onBlur={(e) => onGuardar(e.target.value)}
        className="w-32"
      />
    )
  }

  return (
    <SectionCard className="mt-4">
      <SectionCardHeader
        icon={Clock}
        title="Horario de cada comercial"
        description={`La hora de entrada es contra la que se marca "tarde". Sin hora propia aplica la de la empresa (${horaEmpresa.slice(0, 5)}). Con "Por día" cada día de la semana puede tener otra hora; el día vacío usa la general.`}
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
                <th className="w-36 py-2 text-left font-medium">
                  <span className="sr-only">Horario por día</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map((f) => {
                const open = abierta === f.staffId
                const generalEntrada = hhmm(f.entrada) || hhmm(horaEmpresa)
                const generalSalida = hhmm(f.salida)
                return (
                  <Fragment key={f.staffId}>
                    <tr>
                      <td className="py-2 pr-3">{f.nombre}</td>
                      <td className="py-2 pr-3">
                        {campoHora(
                          `${f.staffId}-hora_entrada`,
                          hhmm(f.entrada),
                          `la de la empresa (${hhmm(horaEmpresa)})`,
                          `Hora de entrada de ${f.nombre}`,
                          (v) => guardar(f, "hora_entrada", v),
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {campoHora(
                          `${f.staffId}-hora_salida`,
                          hhmm(f.salida),
                          "sin hora de salida",
                          `Hora de salida de ${f.nombre}`,
                          (v) => guardar(f, "hora_salida", v),
                        )}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-expanded={open}
                          onClick={() => setAbierta(open ? null : f.staffId)}
                        >
                          {open ? <ChevronDown /> : <ChevronRight />}
                          Por día
                          {f.dias.length > 0 && (
                            <span className="text-xs text-muted-foreground">({f.dias.length})</span>
                          )}
                        </Button>
                      </td>
                    </tr>
                    {open &&
                      DIAS.map((nombreDia, i) => {
                        const dia = i + 1
                        const d = f.dias.find((x) => x.dia === dia)
                        return (
                          <tr key={`${f.staffId}-${dia}`} className="bg-muted/30">
                            <td className="py-1.5 pr-3 pl-6 text-muted-foreground">{nombreDia}</td>
                            <td className="py-1.5 pr-3">
                              {campoHora(
                                `${f.staffId}-${dia}-hora_entrada`,
                                hhmm(d?.entrada),
                                `la general (${generalEntrada})`,
                                `Hora de entrada de ${f.nombre} el ${nombreDia.toLowerCase()}`,
                                (v) => guardarDia(f, dia, "hora_entrada", v),
                              )}
                            </td>
                            <td className="py-1.5 pr-3">
                              {campoHora(
                                `${f.staffId}-${dia}-hora_salida`,
                                hhmm(d?.salida),
                                generalSalida ? `la general (${generalSalida})` : "sin hora de salida",
                                `Hora de salida de ${f.nombre} el ${nombreDia.toLowerCase()}`,
                                (v) => guardarDia(f, dia, "hora_salida", v),
                              )}
                            </td>
                            <td className="py-1.5 text-xs text-muted-foreground">
                              {d ? "Propio" : `General ${generalEntrada}${generalSalida ? `–${generalSalida}` : ""}`}
                            </td>
                          </tr>
                        )
                      })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}
