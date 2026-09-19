"use client"

import { Pencil, Plus, Save } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { CampoNumero, CampoSelect } from "@/components/captura/campos"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveActivity } from "@/lib/data/records-actions"
import { todayISO } from "@/lib/format"
import { totalesJornada } from "@/lib/jornada"
import { cn } from "@/lib/utils"

const CERO = {
  chats_inicial: 0, chats_medio: 0, chats_final: 0,
  tareas_inicial: 0, tareas_medio: 0, tareas_final: 0,
  caducadas_inicial: 0, caducadas_medio: 0, caducadas_final: 0,
  agenda_confirmada: 0, agenda_posible: 0, agenda_reprograma: 0,
  agenda_no_contesta: 0, agenda_cancela: 0,
  llamada_no_contestada: 0, llamada_efectiva: 0, llamada_seguimiento: 0,
  llamada_agenda: 0, llamada_no_interesado: 0, llamada_postventa: 0,
  atencion_venta: 0, atencion_venta_externa: 0, atencion_seguimiento: 0,
  atencion_declinado: 0, atencion_agenda: 0,
  atencion_asociado: 0, atencion_enrolamiento: 0, atencion_certificados: 0,
  atencion_renovacion: 0,
}

type Valores = typeof CERO

/** Una jornada ya registrada, como la devuelve el listado. */
export interface JornadaExistente extends Valores {
  id: string
  branch_id: string
  report_date: string
  staff_id: string
  responsable_nombre: string
  hora_llegada: string | null
  hora_salida: string | null
  notas: string | null
}

/**
 * Bloque del formulario, como los títulos de color de la hoja de Excel.
 *
 * Cada bloque lleva su total calculado al pie: lo que se digita son las
 * tipificaciones y el total sale solo. Cuando el total era una casilla más,
 * el equipo la llenaba a ojo y no cuadraba con el detalle.
 */
function Bloque({
  titulo,
  nota,
  tono,
  totales,
  children,
}: {
  titulo: string
  nota?: string
  tono: "sky" | "emerald" | "amber" | "violet" | "slate"
  /** Totales al pie, ya calculados. Vacío si el bloque no suma nada. */
  totales?: { label: string; value: number; destacado?: boolean }[]
  children: React.ReactNode
}) {
  const tonos = {
    sky: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-100",
    slate: "border-border bg-muted/40 text-foreground",
  }
  return (
    <section className="overflow-hidden rounded-lg border">
      <header className={cn("border-b px-4 py-2", tonos[tono])}>
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {nota && <p className="text-xs opacity-80">{nota}</p>}
      </header>
      <div className="space-y-2.5 p-4">{children}</div>
      {totales && totales.length > 0 && (
        <footer className="space-y-1 border-t bg-muted/30 px-4 py-2.5">
          {totales.map((t) => (
            <div
              key={t.label}
              className={cn(
                "grid grid-cols-[1fr_5rem] items-center gap-3 text-sm",
                t.destacado && "font-semibold",
              )}
            >
              <span className={t.destacado ? "" : "text-muted-foreground"}>{t.label}</span>
              <output
                className="rounded-md border border-dashed px-2 py-1 text-right tabular-nums"
                aria-label={t.label}
              >
                {t.value}
              </output>
            </div>
          ))}
        </footer>
      )}
    </section>
  )
}

/**
 * Registro de la jornada de una persona.
 *
 * Es la misma hoja del Excel, en el mismo orden y con los mismos bloques:
 * llamadas, agendas, atención en tres partes y cola del CRM. Los totales
 * —contestadas, total de llamadas, total de agendas, total de atención— no se
 * escriben: se calculan mientras se digita, y así se ven en la pantalla.
 */
export function NuevaJornada({
  companyId,
  branches,
  staff,
  horaEntrada,
  canManage,
  myStaffId,
  registro,
}: {
  companyId: string
  branches: { id: string; name: string; is_primary: boolean }[]
  staff: { id: string; full_name: string }[]
  horaEntrada: string
  /** Quien administra registra a nombre de cualquiera; el comercial, lo suyo. */
  canManage: boolean
  myStaffId: string | null
  /** Si viene, el formulario corrige esa jornada en vez de crear una. */
  registro?: JornadaExistente
}) {
  const hoy = todayISO()
  const editando = !!registro
  const [open, setOpen] = useState(false)
  const [fecha, setFecha] = useState(registro?.report_date ?? hoy)
  const [staffId, setStaffId] = useState(registro?.staff_id ?? myStaffId ?? "")
  const [branchId, setBranchId] = useState(
    registro?.branch_id ?? branches.find((b) => b.is_primary)?.id ?? branches[0]?.id ?? "",
  )
  const [llegada, setLlegada] = useState(registro?.hora_llegada?.slice(0, 5) ?? "")
  const [salida, setSalida] = useState(registro?.hora_salida?.slice(0, 5) ?? "")
  const [v, setV] = useState<Valores>(
    registro
      ? (Object.fromEntries(
          Object.keys(CERO).map((k) => [k, Number(registro[k as keyof Valores] ?? 0)]),
        ) as Valores)
      : { ...CERO },
  )
  const [notas, setNotas] = useState(registro?.notas ?? "")
  const [pendiente, startTransition] = useTransition()

  const persona = staff.find((s) => s.id === staffId)
  const valido = !!staffId && !!branchId && fecha <= hoy
  const set = (campo: keyof Valores) => (valor: number) => setV((x) => ({ ...x, [campo]: valor }))
  const t = totalesJornada(v)

  function limpiar() {
    setV({ ...CERO })
    setNotas("")
    setLlegada("")
    setSalida("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editando ? (
          <Button variant="ghost" size="icon" className="size-8">
            <Pencil className="size-4" />
            <span className="sr-only">Editar la jornada del {registro.report_date}</span>
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Registrar jornada
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar jornada" : "Registrar jornada"}</DialogTitle>
          <DialogDescription>
            {editando
              ? `Corrigiendo la jornada de ${registro.responsable_nombre}.`
              : "Una jornada por persona y día. Volver a guardar la misma corrige lo registrado. Los totales se calculan solos."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              max={hoy}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
            />
          </div>
          {canManage ? (
            <CampoSelect
              id="persona"
              label="Comercial"
              value={staffId}
              onChange={setStaffId}
              options={staff.map((s) => ({ value: s.id, label: s.full_name }))}
            />
          ) : (
            <div className="min-w-0 space-y-2">
              <Label>Comercial</Label>
              <p className="flex h-8 items-center text-sm">{persona?.full_name ?? "—"}</p>
            </div>
          )}
          <CampoSelect
            id="sede"
            label="Sede"
            value={branchId}
            onChange={setBranchId}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <div className="min-w-0 space-y-2">
            <Label htmlFor="llegada">Hora de llegada</Label>
            <Input
              id="llegada"
              type="time"
              value={llegada}
              onChange={(e) => setLlegada(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se espera a las {horaEntrada.slice(0, 5)}
            </p>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <Bloque
              titulo="Llamadas"
              nota="Se digita cada tipificación; contestadas y el total salen solos."
              tono="sky"
              totales={[
                { label: "Contestadas", value: t.llamadas_contestadas },
                { label: "No contestadas", value: v.llamada_no_contestada },
                { label: "Total de llamadas", value: t.total_llamadas, destacado: true },
              ]}
            >
              <CampoNumero id="ll-efec" label="Efectiva (venta digital)" value={v.llamada_efectiva} onChange={set("llamada_efectiva")} />
              <CampoNumero id="ll-seg" label="Seguimiento" value={v.llamada_seguimiento} onChange={set("llamada_seguimiento")} />
              <CampoNumero id="ll-agen" label="Agenda" value={v.llamada_agenda} onChange={set("llamada_agenda")} />
              <CampoNumero id="ll-noint" label="No interesado" value={v.llamada_no_interesado} onChange={set("llamada_no_interesado")} />
              <CampoNumero id="ll-post" label="Postventa" value={v.llamada_postventa} onChange={set("llamada_postventa")} />
              <div className="border-t pt-2.5">
                <CampoNumero id="ll-nocont" label="No contestada" value={v.llamada_no_contestada} onChange={set("llamada_no_contestada")} />
              </div>
            </Bloque>

            <Bloque
              titulo="Agendas"
              nota="El total incluye las que no contestaron."
              tono="emerald"
              totales={[{ label: "Total de agendas", value: t.total_agendas, destacado: true }]}
            >
              <CampoNumero id="ag-conf" label="Confirmada" value={v.agenda_confirmada} onChange={set("agenda_confirmada")} />
              <CampoNumero id="ag-pos" label="Posible asistencia" value={v.agenda_posible} onChange={set("agenda_posible")} />
              <CampoNumero id="ag-rep" label="Reprograma" value={v.agenda_reprograma} onChange={set("agenda_reprograma")} />
              <CampoNumero id="ag-noc" label="No contesta" value={v.agenda_no_contesta} onChange={set("agenda_no_contesta")} />
              <CampoNumero id="ag-can" label="Cancela" value={v.agenda_cancela} onChange={set("agenda_cancela")} />
            </Bloque>
          </div>

          <div className="space-y-4">
            <Bloque
              titulo="Atención venta presencial"
              nota="El cliente vino al punto: fue venta, seguimiento o declinó."
              tono="amber"
              totales={[
                { label: "Total atención presencial", value: t.total_atencion, destacado: true },
              ]}
            >
              <CampoNumero id="at-venta" label="Venta exitosa" value={v.atencion_venta} onChange={set("atencion_venta")} />
              <CampoNumero id="at-externa" label="Venta externa" value={v.atencion_venta_externa} onChange={set("atencion_venta_externa")} />
              <CampoNumero id="at-seg" label="Seguimiento" value={v.atencion_seguimiento} onChange={set("atencion_seguimiento")} />
              <CampoNumero id="at-dec" label="Declinado" value={v.atencion_declinado} onChange={set("atencion_declinado")} />
            </Bloque>

            <Bloque
              titulo="Atención agenda"
              nota="Cuántos de los agendados vinieron. No suma: ese cliente ya está contado arriba."
              tono="slate"
            >
              <CampoNumero id="at-agen" label="Agenda atendida" value={v.atencion_agenda} onChange={set("atencion_agenda")} />
            </Bloque>

            <Bloque
              titulo="Atención administrativa"
              nota="No es venta. Solo quien la hace la registra."
              tono="violet"
              totales={[
                { label: "Total administrativa", value: t.total_administrativa, destacado: true },
              ]}
            >
              <CampoNumero id="at-asoc" label="Asociado" value={v.atencion_asociado} onChange={set("atencion_asociado")} />
              <CampoNumero id="at-enrol" label="Enrolamiento" value={v.atencion_enrolamiento} onChange={set("atencion_enrolamiento")} />
              <CampoNumero id="at-cert" label="Certificados" value={v.atencion_certificados} onChange={set("atencion_certificados")} />
              <CampoNumero id="at-ren" label="Renovaciones" value={v.atencion_renovacion} onChange={set("atencion_renovacion")} />
            </Bloque>
          </div>

          <div className="space-y-4">
            <Bloque
              titulo="Cola del CRM"
              nota="Al empezar, al medio día y al cerrar."
              tono="slate"
              totales={[
                { label: "Chats depurados", value: v.chats_inicial - v.chats_final },
                { label: "Tareas depuradas", value: v.tareas_inicial - v.tareas_final },
              ]}
            >
              <div className="grid grid-cols-[1fr_repeat(3,4rem)] items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <span />
                <span className="text-right">Inicial</span>
                <span className="text-right">Medio</span>
                <span className="text-right">Final</span>
              </div>
              {([
                ["Chats por responder", "chats_inicial", "chats_medio", "chats_final"],
                ["Tareas del día", "tareas_inicial", "tareas_medio", "tareas_final"],
                ["Tareas caducadas", "caducadas_inicial", "caducadas_medio", "caducadas_final"],
              ] as const).map(([label, ini, med, fin]) => (
                <div key={label} className="grid grid-cols-[1fr_repeat(3,4rem)] items-center gap-2 border-t py-1.5">
                  <Label className="text-sm font-normal">{label}</Label>
                  {[ini, med, fin].map((campo) => (
                    <Input
                      key={campo}
                      id={`crm-${campo}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={v[campo]}
                      onChange={(e) => set(campo)(Math.max(0, Number(e.target.value) || 0))}
                      className="px-2 text-right tabular-nums"
                      aria-label={`${label}, ${campo.split("_")[1]}`}
                    />
                  ))}
                </div>
              ))}
            </Bloque>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="salida">Hora de salida</Label>
                <Input
                  id="salida"
                  type="time"
                  value={salida}
                  onChange={(e) => setSalida(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notas">Notas (opcional)</Label>
                <Textarea id="notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {staff.length === 0 && (
          <Alert>
            <AlertDescription>
              Esta empresa no tiene comerciales en el equipo todavía. Agrégalos en Equipo.
            </AlertDescription>
          </Alert>
        )}

        {!canManage && !myStaffId && (
          <Alert variant="destructive">
            <AlertDescription>
              Tu cuenta no está enlazada con ningún comercial del equipo, así que todavía no
              puedes registrar a tu nombre. Pídele al administrador que la enlace desde Equipo.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pendiente}
            onClick={() =>
              startTransition(async () => {
                const r = await saveActivity({
                  id: registro?.id,
                  company_id: companyId,
                  branch_id: branchId,
                  report_date: fecha,
                  staff_id: staffId,
                  responsable_nombre: persona?.full_name ?? "—",
                  hora_llegada: llegada || null,
                  hora_salida: salida || null,
                  notas: notas.trim() || null,
                  ...v,
                })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo guardar.")
                  return
                }
                toast.success(editando ? "Jornada actualizada" : "Jornada registrada", {
                  description: `${persona?.full_name} · ${fecha} · ${t.total_llamadas} llamadas`,
                })
                if (!editando) limpiar()
                setOpen(false)
              })
            }
          >
            <Save className="size-4" />
            {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "Guardar jornada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
