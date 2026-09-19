"use client"

import { Play } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { abrirJornada } from "@/lib/data/jornada-actions"

/**
 * El botón con el que empieza el día.
 *
 * La sede se pregunta solo cuando hay más de una: en una empresa de una sola
 * oficina, elegirla sería un paso que siempre tiene la misma respuesta.
 */
export function IniciarJornada({
  companyId,
  staffId,
  branches,
}: {
  companyId: string
  staffId: string
  branches: { id: string; name: string; is_primary: boolean }[]
}) {
  const [branchId, setBranchId] = useState(
    branches.find((b) => b.is_primary)?.id ?? branches[0]?.id ?? "",
  )
  const [pendiente, startTransition] = useTransition()

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
      {branches.length > 1 && (
        <div className="w-full space-y-2 text-left">
          <Label htmlFor="jornada-sede">¿Desde qué sede trabajas hoy?</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger id="jornada-sede" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        size="lg"
        className="h-12 w-full text-base"
        disabled={pendiente || !branchId}
        onClick={() =>
          startTransition(async () => {
            const r = await abrirJornada({ companyId, branchId, staffId })
            if (!r.ok) {
              toast.error(r.error ?? "No se pudo abrir la jornada.")
              return
            }
            toast.success("Jornada iniciada", { description: "Que sea un buen día." })
          })
        }
      >
        <Play className="size-5" />
        {pendiente ? "Abriendo…" : "Iniciar jornada"}
      </Button>
    </div>
  )
}
