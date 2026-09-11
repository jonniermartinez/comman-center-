"use client"

import { AlertTriangle } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { diasDesde, necesitaSeguimiento } from "@/lib/seguimiento"

/**
 * Aviso de recontacto.
 *
 * Un alumno que a los 85 días no está certificado se está enfriando: o no
 * volvió al curso, o el trámite se quedó trabado en algún paso. Quien puede
 * destrabarlo es el comercial que le vendió, y para eso tiene que enterarse
 * sin ir a buscarlo. Por eso el aviso vive en la fila de la venta y no en un
 * reporte que alguien tendría que abrir.
 */
export function AlertaSeguimiento({
  fecha,
  estado,
  estadoNombre,
  hoy,
  cliente,
}: {
  fecha: string
  estado: string | null
  estadoNombre: string
  hoy: string
  cliente: string
}) {
  if (!necesitaSeguimiento(fecha, estado, hoy)) return null

  const dias = diasDesde(fecha, hoy)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center text-amber-600"
          aria-label={`${cliente} lleva ${dias} días sin certificarse`}
        >
          <AlertTriangle className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p className="font-medium">Lleva {dias} días sin certificarse</p>
        <p className="mt-1 text-xs">
          {cliente} sigue en «{estadoNombre}». Recontáctalo: a esta altura el alumno ya se enfrió y
          el trámite no avanza solo.
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
