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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { saveActivity } from "@/lib/data/records-actions"
import { todayISO } from "@/lib/format"

const CERO = {
  chats_inicial: 0, chats_medio: 0, chats_final: 0,
  tareas_inicial: 0, tareas_medio: 0, tareas_final: 0,
  caducadas_inicial: 0, caducadas_medio: 0, caducadas_final: 0,
  agenda_confirmada: 0, agenda_posible: 0, agenda_reprograma: 0,
  agenda_no_contesta: 0, agenda_cancela: 0,
  llamada_no_contestada: 0, llamada_efectiva: 0, llamada_seguimiento: 0,
  llamada_agenda: 0, llamada_no_interesado: 0, llamada_contestada: 0,
  llamada_postventa: 0,
  atencion_venta: 0, atencion_seguimiento: 0, atencion_declinado: 0,
  atencion_asociado: 0, atencion_enrolamiento: 0, atencion_certificados: 0,
  atencion_agenda: 0, atencion_renovacion: 0,
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
 * Registro de la jornada de una persona.
 *
 * Es el formulario que se llena todos los días, así que va por pestañas: la
 * cola del CRM se digita al empezar y al terminar, y las llamadas y atenciones
 * se van sumando durante el día. Todo en una sola pantalla obligaría a bajar
 * treinta campos para llegar al que se necesita.
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

      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar jornada" : "Registrar jornada"}</DialogTitle>
          <DialogDescription>
            {editando
              ? `Corrigiendo la jornada de ${registro.responsable_nombre}.`
              : "Una jornada por persona y día. Volver a guardar la misma corrige lo registrado."}
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

        <Tabs defaultValue="llamadas">
          <TabsList>
            <TabsTrigger value="llamadas">Llamadas</TabsTrigger>
            <TabsTrigger value="agendas">Agendas</TabsTrigger>
            <TabsTrigger value="atencion">Atención</TabsTrigger>
            <TabsTrigger value="crm">Cola del CRM</TabsTrigger>
          </TabsList>

          <TabsContent value="llamadas" className="grid gap-3 pt-2 sm:grid-cols-2">
            <CampoNumero id="ll-cont" label="Contestada" value={v.llamada_contestada} onChange={set("llamada_contestada")} />
            <CampoNumero id="ll-nocont" label="No contestada" value={v.llamada_no_contestada} onChange={set("llamada_no_contestada")} />
            <CampoNumero id="ll-efec" label="Efectiva (venta)" value={v.llamada_efectiva} onChange={set("llamada_efectiva")} />
            <CampoNumero id="ll-seg" label="Seguimiento" value={v.llamada_seguimiento} onChange={set("llamada_seguimiento")} />
            <CampoNumero id="ll-agen" label="Agenda" value={v.llamada_agenda} onChange={set("llamada_agenda")} />
            <CampoNumero id="ll-noint" label="No interesado" value={v.llamada_no_interesado} onChange={set("llamada_no_interesado")} />
            <CampoNumero id="ll-post" label="Postventa" value={v.llamada_postventa} onChange={set("llamada_postventa")} />
          </TabsContent>

          <TabsContent value="agendas" className="grid gap-3 pt-2 sm:grid-cols-2">
            <CampoNumero id="ag-conf" label="Confirmada" value={v.agenda_confirmada} onChange={set("agenda_confirmada")} />
            <CampoNumero id="ag-pos" label="Posible asistencia" value={v.agenda_posible} onChange={set("agenda_posible")} />
            <CampoNumero id="ag-rep" label="Reprograma" value={v.agenda_reprograma} onChange={set("agenda_reprograma")} />
            <CampoNumero id="ag-noc" label="No contesta" value={v.agenda_no_contesta} onChange={set("agenda_no_contesta")} />
            <CampoNumero id="ag-can" label="Cancela" value={v.agenda_cancela} onChange={set("agenda_cancela")} />
          </TabsContent>

          <TabsContent value="atencion" className="grid gap-3 pt-2 sm:grid-cols-2">
            <CampoNumero id="at-venta" label="Venta exitosa" value={v.atencion_venta} onChange={set("atencion_venta")} />
            <CampoNumero id="at-seg" label="Seguimiento" value={v.atencion_seguimiento} onChange={set("atencion_seguimiento")} />
            <CampoNumero id="at-dec" label="Declinado" value={v.atencion_declinado} onChange={set("atencion_declinado")} />
            <CampoNumero id="at-agen" label="Agenda atendida" value={v.atencion_agenda} onChange={set("atencion_agenda")} />
            <CampoNumero id="at-cert" label="Certificados" value={v.atencion_certificados} onChange={set("atencion_certificados")} />
            <CampoNumero id="at-enrol" label="Enrolamiento" value={v.atencion_enrolamiento} onChange={set("atencion_enrolamiento")} />
            <CampoNumero id="at-asoc" label="Asociado" value={v.atencion_asociado} onChange={set("atencion_asociado")} />
            <CampoNumero id="at-ren" label="Renovaciones" value={v.atencion_renovacion} onChange={set("atencion_renovacion")} />
          </TabsContent>

          <TabsContent value="crm" className="pt-2">
            <div className="grid grid-cols-[1fr_repeat(3,5rem)] items-center gap-3 pb-2 text-xs font-medium text-muted-foreground">
              <span />
              <span className="text-right">Inicial</span>
              <span className="text-right">Medio día</span>
              <span className="text-right">Final</span>
            </div>
            {([
              ["Chats por responder", "chats_inicial", "chats_medio", "chats_final"],
              ["Tareas del día", "tareas_inicial", "tareas_medio", "tareas_final"],
              ["Tareas caducadas", "caducadas_inicial", "caducadas_medio", "caducadas_final"],
            ] as const).map(([label, ini, med, fin]) => (
              <div key={label} className="grid grid-cols-[1fr_repeat(3,5rem)] items-center gap-3 border-t py-2">
                <Label className="text-sm font-normal">{label}</Label>
                {[ini, med, fin].map((campo) => (
                  <Input
                    key={campo}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={v[campo]}
                    onChange={(e) => set(campo)(Math.max(0, Number(e.target.value) || 0))}
                    className="text-right tabular-nums"
                  />
                ))}
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              La diferencia entre lo inicial y lo final es lo que se depuró en el día.
            </p>
          </TabsContent>
        </Tabs>

        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
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
            <Textarea id="notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
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
                  description: `${persona?.full_name} · ${fecha}`,
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
