"use client"

import {
  CalendarClock,
  ChevronDown,
  ExternalLink,
  History,
  MessageCircle,
  Phone,
  PhoneOutgoing,
} from "lucide-react"
import { useState } from "react"

import { DialogAsistencia, DialogLlamada } from "@/components/agendas/gestionar-agenda"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MAX_SEGUIMIENTOS, armarRecordatorio, estadoDe } from "@/lib/agendas"
import type { AgendaRow, EventoRow } from "@/lib/data/agendas"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { enlaceWhatsApp } from "@/lib/whatsapp"

const EVENTOS: Record<string, string> = {
  no_contesta: "No contestó",
  confirma: "Confirmó",
  posible: "Posible asistencia",
  reprograma: "Pidió otra fecha",
  cancela: "Canceló",
  asistio: "Asistió",
  no_asistio: "No asistió",
  descartada: "Descartado",
  movida_en_kommo: "Kommo movió la fecha",
}

/** "hoy", "mañana" o la fecha. Un día concreto se lee peor que la palabra. */
function cuando(fecha: string, hoy: string): string {
  if (fecha === hoy) return "Hoy"
  const dia = 86_400_000
  const diff = Math.round((Date.parse(`${fecha}T00:00:00`) - Date.parse(`${hoy}T00:00:00`)) / dia)
  if (diff === 1) return "Mañana"
  if (diff === -1) return "Ayer"
  if (diff > 1 && diff <= 7) return `En ${diff} días`
  if (diff < -1 && diff >= -7) return `Hace ${-diff} días`
  return formatDate(fecha)
}

/**
 * Un cliente de la cola, con lo que hay que hacer con él.
 *
 * Es una tarjeta y no una fila de tabla a propósito: esto no se consulta, se
 * trabaja. Lo que se necesita para trabajarlo —la hora, el celular, en qué
 * quedó la última llamada y el botón que sigue— tiene que caber en el pulgar
 * de un celular, y una tabla de ocho columnas no cabe.
 */
export function FilaAgenda({
  fila,
  historial,
  companyName,
  plantilla,
  hoy,
}: {
  fila: AgendaRow
  historial: EventoRow[]
  companyName: string
  plantilla: string | null
  hoy: string
}) {
  const [llamada, setLlamada] = useState(false)
  const [asistencia, setAsistencia] = useState(false)
  const [abierto, setAbierto] = useState(false)

  const estado = estadoDe(fila.estado_efectivo ?? "pendiente")
  const cliente = fila.nombre?.trim() || "Cliente sin nombre"
  const fecha = fila.scheduled_at ?? hoy
  const pasada = fecha < hoy
  const sinCupo = (fila.seguimientos_post ?? 0) >= MAX_SEGUIMIENTOS

  const whatsapp = enlaceWhatsApp(
    fila.celular,
    armarRecordatorio(plantilla, {
      cliente: fila.nombre,
      fecha,
      hora: fila.scheduled_time,
      empresa: companyName,
    }),
  )

  // Llegó el día y el cliente dijo que venía: lo que falta es decir si vino.
  // Antes de eso, o sin confirmación, lo que falta es la llamada.
  const marcarAsistencia =
    fecha <= hoy && ["confirmada", "posible"].includes(fila.estado ?? "pendiente")

  return (
    <li className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{cliente}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={cn("border-transparent", estado.tono)}>{estado.label}</Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-56">{estado.ayuda}</TooltipContent>
            </Tooltip>
          </div>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">
              {cuando(fecha, hoy)}
              {fila.scheduled_time && ` · ${fila.scheduled_time.slice(0, 5)}`}
            </span>
            {fila.celular && <span className="tabular-nums">{fila.celular}</span>}
            {fila.responsable_nombre && <span className="truncate">{fila.responsable_nombre}</span>}
          </p>

          {fila.observacion && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{fila.observacion}</p>
          )}

          {fila.reprogramada_para && fila.reprogramada_para > fecha && (
            <p className="flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-300">
              <CalendarClock className="size-3.5 shrink-0" />
              Pidió el {formatDate(fila.reprogramada_para)}. Falta moverla en Kommo.
            </p>
          )}

          {pasada && (fila.seguimientos_post ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              Seguimiento {fila.seguimientos_post} de {MAX_SEGUIMIENTOS}
              {sinCupo && " · ya no quedan llamadas"}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {fila.celular && (
            <Button asChild variant="ghost" size="icon-sm" title={`Llamar a ${cliente}`}>
              <a href={`tel:${fila.celular.replace(/\D/g, "")}`}>
                <Phone className="size-4" />
                <span className="sr-only">Llamar a {cliente}</span>
              </a>
            </Button>
          )}

          {whatsapp && (
            <Button asChild variant="ghost" size="icon-sm" title="Recordatorio por WhatsApp">
              <a href={whatsapp} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" />
                <span className="sr-only">Recordatorio por WhatsApp a {cliente}</span>
              </a>
            </Button>
          )}

          {fila.external_url && (
            <Button asChild variant="ghost" size="icon-sm" title="Abrir en Kommo">
              <a href={fila.external_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                <span className="sr-only">Abrir en Kommo</span>
              </a>
            </Button>
          )}

          {marcarAsistencia ? (
            <Button size="sm" onClick={() => setAsistencia(true)}>
              <CalendarClock className="size-3.5" />
              ¿Vino?
            </Button>
          ) : (
            <Button size="sm" disabled={sinCupo && pasada} onClick={() => setLlamada(true)}>
              <PhoneOutgoing className="size-3.5" />
              Tipificar
            </Button>
          )}
        </div>
      </div>

      {historial.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <History className="size-3.5" />
            {historial.length} {historial.length === 1 ? "gestión" : "gestiones"}
            <ChevronDown className={cn("size-3.5 transition-transform", abierto && "rotate-180")} />
          </button>

          {abierto && (
            <ol className="mt-2 space-y-1.5">
              {historial.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {new Date(e.ocurrido_en).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-medium text-foreground">
                    {EVENTOS[e.tipo] ?? e.tipo}
                  </span>
                  {e.detalle && <span className="min-w-0 flex-1">{e.detalle}</span>}
                  {e.actor_nombre && <span>· {e.actor_nombre}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <DialogLlamada
        agendaId={fila.id!}
        companyId={fila.company_id!}
        cliente={cliente}
        esSeguimiento={pasada}
        seguimientos={fila.seguimientos_post ?? 0}
        open={llamada}
        onOpenChange={setLlamada}
      />
      <DialogAsistencia
        agendaId={fila.id!}
        companyId={fila.company_id!}
        cliente={cliente}
        open={asistencia}
        onOpenChange={setAsistencia}
      />
    </li>
  )
}
