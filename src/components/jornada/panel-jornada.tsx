"use client"

import {
  ArrowLeft,
  CalendarCheck,
  ClipboardList,
  Coffee,
  GraduationCap,
  PhoneOff,
  PhoneCall,
  Play,
  Square,
  UserRound,
} from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { DialogCrm } from "@/components/jornada/dialog-crm"
import { SectionCard, SectionCardHeader } from "@/components/section-card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { JornadaEvento, MiJornada } from "@/lib/data/mi-jornada"
import { cerrarJornada, pausar, tipificar } from "@/lib/data/jornada-actions"
import {
  ADMINISTRATIVA,
  LLAMADA_AGENDA,
  LLAMADA_COMERCIAL,
  PAUSAS,
  PRESENCIAL_COMERCIAL,
  duracionCorta,
  etiqueta,
  hms,
  type Opcion,
  type TipoPausa,
} from "@/lib/mi-jornada"
import { cn } from "@/lib/utils"

const ICONO_PAUSA: Record<TipoPausa, React.ComponentType<{ className?: string }>> = {
  bano: UserRound,
  capacitacion: GraduationCap,
  almuerzo: Coffee,
}

/** Un cronómetro que corre en el navegador desde una marca del servidor. */
function Reloj({ desde, className }: { desde: string; className?: string }) {
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className={cn("tabular-nums", className)}>{hms(ahora - Date.parse(desde))}</span>
  )
}

/** Botón de tipificación: grande, de color, y del ancho de la columna. */
function BotonOpcion({
  opcion,
  disabled,
  onClick,
}: {
  opcion: Opcion
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-4 text-sm font-medium transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        opcion.tono,
      )}
    >
      {opcion.label}
    </button>
  )
}

/**
 * La jornada, mientras pasa.
 *
 * Todo lo que el comercial necesita con el teléfono en la oreja cabe en la
 * primera pantalla: el cronómetro de la llamada actual y dos botones. La
 * tipificación llega en un segundo toque, que es cuando ya colgó y sabe en qué
 * quedó. El resto —pausas, presencial, CRM— vive debajo, porque se usa unas
 * pocas veces al día y no puede competir con lo que se usa cien.
 */
export function PanelJornada({
  jornada,
  companyId,
  horaEntrada,
}: {
  jornada: MiJornada
  companyId: string
  horaEntrada: string
}) {
  const { resumen, eventos, crm } = jornada
  const [paso, setPaso] = useState<"inicio" | "contestada" | "agenda">("inicio")
  const [admin, setAdmin] = useState(false)
  const [presencial, setPresencial] = useState<null | "elegir" | "comercial" | "administrativa">(null)
  const [cerrando, setCerrando] = useState(false)
  const [pendiente, startTransition] = useTransition()

  const enPausa = Boolean(resumen.pausa_tipo)
  const cerrada = Boolean(resumen.fin)

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) {
    startTransition(async () => {
      const r = await accion()
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo registrar.")
        return
      }
      toast.success(exito)
      setPaso("inicio")
      setAdmin(false)
      setPresencial(null)
    })
  }

  const registrar = (
    clase: "llamada" | "atencion",
    categoria: "comercial" | "administrativa",
    tipificacion: string | null,
    contestada?: boolean,
  ) =>
    correr(
      () =>
        tipificar({
          jornadaId: resumen.id!,
          companyId,
          clase,
          categoria,
          tipificacion,
          contestada,
        }),
      tipificacion ? `Registrado: ${etiqueta(tipificacion)}` : "Registrado: no contestó",
    )

  if (cerrada) {
    return <JornadaCerrada jornada={jornada} companyId={companyId} horaEntrada={horaEntrada} />
  }

  return (
    <div className="space-y-4">
      {/* ---- Cronómetro de jornada ---- */}
      <SectionCard className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Jornada en curso</p>
          <Reloj desde={resumen.inicio!} className="text-3xl font-semibold" />
          <p className="mt-0.5 text-xs text-muted-foreground">
            Abriste a las{" "}
            {new Date(resumen.inicio!).toLocaleTimeString("es-CO", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Bogota",
            })}
            {" · se espera al equipo a las "}
            {horaEntrada.slice(0, 5)}
          </p>
        </div>
        <Button variant="outline" disabled={pendiente} onClick={() => setCerrando(true)}>
          <Square className="size-4" />
          Cerrar jornada
        </Button>
      </SectionCard>

      {/* ---- El panel de llamada, o la pausa ---- */}
      {enPausa ? (
        <SectionCard className="bg-muted/40 text-center">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Pausa en curso · {etiqueta(resumen.pausa_tipo)}
          </p>
          <Reloj desde={resumen.pausa_inicio!} className="text-4xl font-semibold" />
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Mientras la pausa corra no se registran gestiones, y este tiempo no cuenta como
            trabajado.
          </p>
          <Button
            className="mt-4"
            disabled={pendiente}
            onClick={() =>
              correr(() => pausar({ jornadaId: resumen.id! }), "Pausa terminada")
            }
          >
            <Play className="size-4" />
            Volver al trabajo
          </Button>
        </SectionCard>
      ) : (
        <SectionCard className="text-center">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Llamada actual
          </p>
          <Reloj desde={resumen.ultima_marca!} className="text-4xl font-semibold" />

          {paso === "inicio" && (
            <>
              <div className="mx-auto mt-5 grid max-w-xl gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => setPaso("contestada")}
                  className="rounded-xl bg-primary px-4 py-5 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                >
                  <PhoneCall className="mx-auto mb-1 size-5" />
                  Contestada
                </button>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => registrar("llamada", "comercial", null, false)}
                  className="rounded-xl border bg-card px-4 py-5 text-base font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                >
                  <PhoneOff className="mx-auto mb-1 size-5" />
                  No contestada
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                El tiempo de arriba es lo que lleva esta llamada. Se guarda con la tipificación.
              </p>
            </>
          )}

          {paso === "contestada" && (
            <>
              <p className="mt-5 text-sm font-medium">¿En qué quedó?</p>
              <div className="mx-auto mt-3 grid max-w-xl gap-3 sm:grid-cols-2">
                {LLAMADA_COMERCIAL.map((o) => (
                  <BotonOpcion
                    key={o.code}
                    opcion={o}
                    disabled={pendiente}
                    onClick={() => registrar("llamada", "comercial", o.code, true)}
                  />
                ))}
              </div>
              <div className="mx-auto mt-3 max-w-xl">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={pendiente}
                  onClick={() => setPaso("agenda")}
                >
                  <CalendarCheck className="size-4" />
                  Era para confirmar una cita ya agendada
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                disabled={pendiente}
                onClick={() => setPaso("inicio")}
              >
                <ArrowLeft className="size-4" />
                Volver
              </Button>
            </>
          )}

          {paso === "agenda" && (
            <>
              <p className="mt-5 text-sm font-medium">¿Qué dijo sobre su cita?</p>
              <div className="mx-auto mt-3 grid max-w-xl gap-3 sm:grid-cols-2">
                {LLAMADA_AGENDA.map((o) => (
                  <BotonOpcion
                    key={o.code}
                    opcion={o}
                    disabled={pendiente}
                    onClick={() => registrar("llamada", "comercial", o.code, true)}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Esto cuenta la llamada. La cita en sí se mueve en Kommo, como siempre.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                disabled={pendiente}
                onClick={() => setPaso("contestada")}
              >
                <ArrowLeft className="size-4" />
                Volver
              </Button>
            </>
          )}
        </SectionCard>
      )}

      {!enPausa && paso === "inicio" && (
        <>
          {/* ---- Otras gestiones ---- */}
          <SectionCard>
            <SectionCardHeader
              icon={ClipboardList}
              title="Otras gestiones"
              description="Suman al conteo del día con su propia tipificación."
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={pendiente} onClick={() => setAdmin(true)}>
                <PhoneCall className="size-4" />
                Llamada administrativa
              </Button>
              <Button variant="outline" disabled={pendiente} onClick={() => setPresencial("elegir")}>
                <UserRound className="size-4" />
                Atención presencial
              </Button>
            </div>
          </SectionCard>

          {/* ---- Pausas ---- */}
          <SectionCard>
            <SectionCardHeader
              icon={Coffee}
              title="Pausas"
              description="El tiempo en pausa se descuenta del tiempo efectivo del día."
            />
            <div className="flex flex-wrap gap-2">
              {PAUSAS.map((p) => {
                const Icono = ICONO_PAUSA[p.code]
                return (
                  <Button
                    key={p.code}
                    variant="outline"
                    disabled={pendiente}
                    onClick={() =>
                      correr(
                        () => pausar({ jornadaId: resumen.id!, tipo: p.code }),
                        `Pausa iniciada: ${p.label}`,
                      )
                    }
                  >
                    <Icono className="size-4" />
                    {p.label}
                  </Button>
                )
              })}
            </div>
          </SectionCard>

          <DialogCrm jornadaId={resumen.id!} crm={crm} />
        </>
      )}

      <UltimasGestiones eventos={eventos} />

      {/* ---- Llamada administrativa ---- */}
      <Dialog open={admin} onOpenChange={(v) => !pendiente && setAdmin(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Llamada administrativa</DialogTitle>
            <DialogDescription>Trámites, no venta. Suman en el bloque administrativo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {ADMINISTRATIVA.map((o) => (
              <BotonOpcion
                key={o.code}
                opcion={o}
                disabled={pendiente}
                onClick={() => registrar("llamada", "administrativa", o.code, true)}
              />
            ))}
            <Button
              variant="outline"
              className="mt-1"
              disabled={pendiente}
              onClick={() => registrar("llamada", "administrativa", null, false)}
            >
              <PhoneOff className="size-4" />
              No contestó
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Atención presencial ---- */}
      <Dialog open={presencial !== null} onOpenChange={(v) => !pendiente && setPresencial(v ? "elegir" : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atención presencial</DialogTitle>
            <DialogDescription>
              {presencial === "elegir"
                ? "El cliente vino al punto. ¿De qué se trató?"
                : "¿En qué terminó?"}
            </DialogDescription>
          </DialogHeader>

          {presencial === "elegir" && (
            <div className="grid gap-2">
              <Button variant="outline" className="h-12" onClick={() => setPresencial("comercial")}>
                Comercial
              </Button>
              <Button
                variant="outline"
                className="h-12"
                onClick={() => setPresencial("administrativa")}
              >
                Administrativa
              </Button>
            </div>
          )}

          {presencial === "comercial" && (
            <div className="grid gap-2">
              {PRESENCIAL_COMERCIAL.map((o) => (
                <BotonOpcion
                  key={o.code}
                  opcion={o}
                  disabled={pendiente}
                  onClick={() => registrar("atencion", "comercial", o.code)}
                />
              ))}
            </div>
          )}

          {presencial === "administrativa" && (
            <div className="grid gap-2">
              {ADMINISTRATIVA.map((o) => (
                <BotonOpcion
                  key={o.code}
                  opcion={o}
                  disabled={pendiente}
                  onClick={() => registrar("atencion", "administrativa", o.code)}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Cerrar ---- */}
      <Dialog open={cerrando} onOpenChange={(v) => !pendiente && setCerrando(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cerrar la jornada?</DialogTitle>
            <DialogDescription>
              Queda la hora de salida y se arma el reporte del día. Si te falta algo, puedes
              volver a abrirla.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={pendiente} onClick={() => setCerrando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  const r = await cerrarJornada({ jornadaId: resumen.id!, companyId })
                  if (!r.ok) {
                    toast.error(r.error ?? "No se pudo cerrar.")
                    return
                  }
                  toast.success("Jornada cerrada")
                  setCerrando(false)
                })
              }
            >
              <Square className="size-4" />
              {pendiente ? "Cerrando…" : "Cerrar jornada"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Lo último que se registró, para saber que el toque sí quedó. */
function UltimasGestiones({ eventos }: { eventos: JornadaEvento[] }) {
  if (eventos.length === 0) {
    return (
      <SectionCard className="py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Todavía no has registrado nada hoy. La primera llamada que tipifiques aparece acá.
        </p>
      </SectionCard>
    )
  }

  return (
    <SectionCard>
      <SectionCardHeader icon={ClipboardList} title="Lo último de hoy" />
      <ul className="divide-y text-sm">
        {eventos.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="w-14 shrink-0 tabular-nums text-muted-foreground">
              {new Date(e.fin).toLocaleTimeString("es-CO", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Bogota",
              })}
            </span>
            <span className="min-w-0 flex-1">
              {e.clase === "pausa" ? (
                <>Pausa · {etiqueta(e.tipificacion)}</>
              ) : e.clase === "atencion" ? (
                <>Presencial · {etiqueta(e.tipificacion)}</>
              ) : e.contestada ? (
                <>Llamada · {etiqueta(e.tipificacion)}</>
              ) : (
                <span className="text-muted-foreground">Llamada · no contestó</span>
              )}
              {e.categoria === "administrativa" && (
                <span className="ml-1.5 text-xs text-muted-foreground">(admin)</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
              {duracionCorta(e.duracion_ms ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

/** El reporte de cierre, y la puerta para volver a abrir si faltó algo. */
function JornadaCerrada({
  jornada,
  companyId,
  horaEntrada,
}: {
  jornada: MiJornada
  companyId: string
  horaEntrada: string
}) {
  const { resumen } = jornada
  const [pendiente, startTransition] = useTransition()

  const tiles = [
    { label: "Tiempo laborado", valor: hms(Number(resumen.laborado_ms ?? 0)) },
    { label: "Tiempo efectivo", valor: hms(Number(resumen.efectivo_ms ?? 0)), nota: "Sin pausas" },
    {
      label: "En pausas",
      valor: hms(Number(resumen.pausas_ms ?? 0)),
      nota: `${resumen.pausas ?? 0} ${resumen.pausas === 1 ? "pausa" : "pausas"}`,
    },
    {
      label: "Llamadas",
      valor: String(resumen.llamadas ?? 0),
      nota: `${resumen.contestadas ?? 0} contestadas · ${resumen.no_contestadas ?? 0} no`,
    },
    {
      label: "Promedio por llamada",
      valor: duracionCorta(Number(resumen.promedio_llamada_ms ?? 0)),
    },
    { label: "Atenciones presenciales", valor: String(resumen.atenciones ?? 0) },
  ]

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionCardHeader
          icon={CalendarCheck}
          title="Jornada cerrada"
          description={`Cerraste a las ${new Date(resumen.fin!).toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Bogota",
          })}. Este es el reporte del día.`}
          actions={
            <Button
              variant="outline"
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  const { abrirJornada } = await import("@/lib/data/jornada-actions")
                  const r = await abrirJornada({
                    companyId,
                    branchId: resumen.branch_id!,
                    staffId: resumen.staff_id!,
                  })
                  if (!r.ok) toast.error(r.error ?? "No se pudo reabrir.")
                  else toast.success("Jornada abierta otra vez")
                })
              }
            >
              <Play className="size-4" />
              Seguir registrando
            </Button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border bg-muted/40 px-4 py-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">{t.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{t.valor}</p>
              {t.nota && <p className="text-xs text-muted-foreground">{t.nota}</p>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Se esperaba al equipo a las {horaEntrada.slice(0, 5)}. Los contadores del día ya están
          en Gestión Diaria; no hay que volver a digitarlos.
        </p>
      </SectionCard>

      <UltimasGestiones eventos={jornada.eventos} />
    </div>
  )
}
