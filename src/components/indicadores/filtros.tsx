"use client"

import { Check, ChevronsUpDown, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { finDeMes } from "@/lib/indicadores"
import { cn } from "@/lib/utils"

export type ModoFecha = "mes" | "dia" | "rango"

/**
 * Filtros del tablero de indicadores, como los de fecha de Excel.
 *
 * Tres formas de decir el período —un mes, un día, un rango— y una lista de
 * comerciales donde se marcan uno, varios o todos. Todo va a la URL: el enlace
 * a "Erika y Miguel en la primera quincena" se puede pegar en el chat.
 */
export function FiltrosIndicadores({
  comerciales,
  desde,
  hasta,
  seleccionados,
}: {
  comerciales: { id: string; full_name: string }[]
  desde: string
  hasta: string
  /** Ids de comerciales filtrados. Vacío es "todos". */
  seleccionados: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const esMes = desde.endsWith("-01") && hasta === finDeMes(desde)
  const modoInicial: ModoFecha = esMes ? "mes" : desde === hasta ? "dia" : "rango"
  const [modo, setModo] = useState<ModoFecha>(modoInicial)
  const [abierto, setAbierto] = useState(false)

  function aplicar(cambios: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (!valor) next.delete(clave)
      else next.set(clave, valor)
    }
    router.push(`${pathname}?${next.toString()}`)
  }

  function alternar(id: string) {
    const nuevo = seleccionados.includes(id)
      ? seleccionados.filter((s) => s !== id)
      : [...seleccionados, id]
    aplicar({ c: nuevo.join(",") || undefined })
  }

  const etiquetaComerciales =
    seleccionados.length === 0
      ? "Todos los comerciales"
      : seleccionados.length === 1
        ? (comerciales.find((c) => c.id === seleccionados[0])?.full_name ?? "1 comercial")
        : `${seleccionados.length} comerciales`

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Período</Label>
        <div className="flex rounded-md border bg-background p-0.5">
          {(
            [
              ["mes", "Mes"],
              ["dia", "Día"],
              ["rango", "Rango"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setModo(valor)}
              className={cn(
                "rounded-sm px-3 py-1 text-sm transition-colors",
                modo === valor ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={modo === valor}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {modo === "mes" && (
        <div className="space-y-1.5">
          <Label htmlFor="mes" className="text-xs text-muted-foreground">
            Mes
          </Label>
          <Input
            id="mes"
            type="month"
            value={desde.slice(0, 7)}
            onChange={(e) => {
              if (!e.target.value) return
              const mes = `${e.target.value}-01`
              aplicar({ desde: mes, hasta: finDeMes(mes) })
            }}
            className="w-44"
          />
        </div>
      )}

      {modo === "dia" && (
        <div className="space-y-1.5">
          <Label htmlFor="dia" className="text-xs text-muted-foreground">
            Fecha
          </Label>
          <Input
            id="dia"
            type="date"
            value={desde === hasta ? desde : ""}
            onChange={(e) => e.target.value && aplicar({ desde: e.target.value, hasta: e.target.value })}
            className="w-40"
          />
        </div>
      )}

      {modo === "rango" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="desde" className="text-xs text-muted-foreground">
              Desde
            </Label>
            <Input
              id="desde"
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => e.target.value && aplicar({ desde: e.target.value })}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hasta" className="text-xs text-muted-foreground">
              Hasta
            </Label>
            <Input
              id="hasta"
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => e.target.value && aplicar({ hasta: e.target.value })}
              className="w-40"
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Comerciales</Label>
        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={abierto}
              className="w-64 justify-between font-normal"
            >
              <span className="truncate">{etiquetaComerciales}</span>
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar comercial…" />
              <CommandList>
                <CommandEmpty>Nadie con ese nombre.</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => aplicar({ c: undefined })}>
                    <Check
                      className={cn(
                        "size-4",
                        seleccionados.length === 0 ? "opacity-100" : "opacity-0",
                      )}
                    />
                    Todos
                  </CommandItem>
                  {comerciales.map((c) => (
                    <CommandItem key={c.id} value={c.full_name} onSelect={() => alternar(c.id)}>
                      <Check
                        className={cn(
                          "size-4",
                          seleccionados.includes(c.id) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {c.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {(seleccionados.length > 0 || params.get("desde")) && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="size-4" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
