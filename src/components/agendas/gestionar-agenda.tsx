"use client"

import { CalendarClock, CheckCheck, PhoneOutgoing } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ASISTENCIAS, MAX_SEGUIMIENTOS, hoyEnBogota } from "@/lib/agendas"
import { registrarAsistencia, registrarLlamada } from "@/lib/data/agendas-actions"
import { cn } from "@/lib/utils"

/** Una opción grande, del ancho de la columna: se elige con el pulgar. */
function Opcion({
  activa,
  onClick,
  children,
  tono,
}: {
  activa: boolean
  onClick: () => void
  children: React.ReactNode
  tono?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
        "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        activa ? "border-primary bg-primary/10 text-foreground" : "border-border",
        activa && tono,
      )}
    >
      {children}
    </button>
  )
}

/**
 * En qué quedó la llamada de validación.
 *
 * Las cinco opciones se ven de una vez, sin desplegable: el comercial acaba de
 * colgar y lo que sigue es un toque, no una búsqueda. La fecha nueva solo
 * aparece si eligió reprogramar, porque pedirla siempre haría que el caso
 * normal cueste un campo de más.
 */
export function DialogLlamada({
  agendaId,
  companyId,
  cliente,
  esSeguimiento,
  seguimientos,
  open,
  onOpenChange,
}: {
  agendaId: string
  companyId: string
  cliente: string
  /** La cita ya pasó: lo que queda es una fecha nueva o soltar al cliente. */
  esSeguimiento: boolean
  seguimientos: number
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [resultado, setResultado] = useState<
    "no_contesta" | "confirma" | "posible" | "reprograma" | "cancela" | null
  >(null)
  const [fecha, setFecha] = useState(hoyEnBogota())
  const [nota, setNota] = useState("")
  const [pendiente, startTransition] = useTransition()

  const cerrar = (v: boolean) => {
    if (pendiente) return
    if (!v) {
      setResultado(null)
      setNota("")
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿En qué quedó la llamada?</DialogTitle>
          <DialogDescription>
            {cliente}
            {esSeguimiento && (
              <>
                {" · "}
                Seguimiento {seguimientos + 1} de {MAX_SEGUIMIENTOS}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Opcion activa={resultado === "no_contesta"} onClick={() => setResultado("no_contesta")}>
            No contestó
          </Opcion>

          {!esSeguimiento && (
            <>
              <Opcion activa={resultado === "confirma"} onClick={() => setResultado("confirma")}>
                Confirma que viene
              </Opcion>
              <Opcion activa={resultado === "posible"} onClick={() => setResultado("posible")}>
                Posible asistencia
              </Opcion>
            </>
          )}

          <Opcion activa={resultado === "reprograma"} onClick={() => setResultado("reprograma")}>
            Pide otra fecha
          </Opcion>
          <Opcion activa={resultado === "cancela"} onClick={() => setResultado("cancela")}>
            Cancela
          </Opcion>
        </div>

        {resultado === "reprograma" && (
          <div className="space-y-2">
            <Label htmlFor="agenda-fecha">¿Para cuándo?</Label>
            <Input
              id="agenda-fecha"
              type="date"
              value={fecha}
              min={hoyEnBogota()}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Queda anotada acá, pero la cita vive en Kommo: muévela allá para que exista ese día.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="agenda-nota">Nota (opcional)</Label>
          <Textarea
            id="agenda-nota"
            rows={2}
            value={nota}
            maxLength={280}
            placeholder="Lo que haya que recordar de esta llamada."
            onChange={(e) => setNota(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pendiente} onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pendiente || !resultado}
            onClick={() =>
              startTransition(async () => {
                if (!resultado) return
                const r = await registrarLlamada({
                  agendaId,
                  companyId,
                  resultado,
                  fecha: resultado === "reprograma" ? fecha : null,
                  nota,
                })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo registrar la llamada.")
                  return
                }
                toast.success("Llamada registrada", {
                  description: "Ya suma en tu jornada de hoy.",
                })
                cerrar(false)
              })
            }
          >
            <PhoneOutgoing className="size-4" />
            {pendiente ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Llegó el día: vino o no vino.
 *
 * Descartar vive acá y no en un menú aparte porque es la misma decisión del
 * mismo momento: no vino, ya se le insistió, se suelta.
 */
export function DialogAsistencia({
  agendaId,
  companyId,
  cliente,
  open,
  onOpenChange,
}: {
  agendaId: string
  companyId: string
  cliente: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [resultado, setResultado] = useState<
    "venta" | "seguimiento" | "no_interesado" | "no_asistio" | "descartada" | null
  >(null)
  const [nota, setNota] = useState("")
  const [pendiente, startTransition] = useTransition()

  const cerrar = (v: boolean) => {
    if (pendiente) return
    if (!v) {
      setResultado(null)
      setNota("")
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Vino a la cita?</DialogTitle>
          <DialogDescription>{cliente}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Vino, y la visita terminó en…</p>
          {ASISTENCIAS.map((a) => (
            <Opcion
              key={a.code}
              activa={resultado === a.code}
              onClick={() => setResultado(a.code)}
            >
              {a.label}
            </Opcion>
          ))}

          <p className="mt-2 text-xs font-medium text-muted-foreground">No vino</p>
          <Opcion activa={resultado === "no_asistio"} onClick={() => setResultado("no_asistio")}>
            No asistió — se le hará seguimiento
          </Opcion>
          <Opcion activa={resultado === "descartada"} onClick={() => setResultado("descartada")}>
            No asistió — se descarta el cliente
          </Opcion>
        </div>

        <div className="space-y-2">
          <Label htmlFor="asistencia-nota">Nota (opcional)</Label>
          <Textarea
            id="asistencia-nota"
            rows={2}
            value={nota}
            maxLength={280}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pendiente} onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pendiente || !resultado}
            onClick={() =>
              startTransition(async () => {
                if (!resultado) return
                const r = await registrarAsistencia({ agendaId, companyId, resultado, nota })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo registrar la asistencia.")
                  return
                }
                toast.success("Asistencia registrada")
                cerrar(false)
              })
            }
          >
            {resultado === "no_asistio" || resultado === "descartada" ? (
              <CalendarClock className="size-4" />
            ) : (
              <CheckCheck className="size-4" />
            )}
            {pendiente ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
