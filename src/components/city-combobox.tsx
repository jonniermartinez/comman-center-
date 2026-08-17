"use client"

import { Check, ChevronsUpDown, MapPin } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DEPARTAMENTOS, MUNICIPIOS, normalizar, type Municipio } from "@/lib/colombia"
import { cn } from "@/lib/utils"

/** Cuántos resultados se pintan a la vez. 1.103 municipios en el DOM traba el filtro. */
const MAX_VISIBLE = 60

export interface CityValue {
  ciudad: string
  departamento?: string
}

/**
 * Selector de municipio de Colombia con búsqueda. Muestra siempre el
 * departamento porque hay nombres repetidos (Armenia, Caldas, Granada,
 * La Victoria…) y "Armenia" sola es ambigua.
 *
 * El filtrado es propio, no el de cmdk: hay que ignorar tildes ("tulua" →
 * "Tuluá") y cortar la lista, y el filtro interno recorrería los 1.103.
 */
export function CityCombobox({
  value,
  onChange,
  id,
  placeholder = "Busca un municipio",
  className,
}: {
  value: CityValue
  onChange: (next: CityValue) => void
  id?: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const { resultados, ocultos } = useMemo(() => {
    const q = normalizar(query.trim())

    if (!q) {
      // Sin búsqueda: se muestran los primeros, agrupados por departamento.
      return { resultados: MUNICIPIOS.slice(0, MAX_VISIBLE), ocultos: MUNICIPIOS.length - MAX_VISIBLE }
    }

    const empiezan: Municipio[] = []
    const contienen: Municipio[] = []
    for (const m of MUNICIPIOS) {
      const nombre = normalizar(m.ciudad)
      if (nombre.startsWith(q)) empiezan.push(m)
      else if (nombre.includes(q) || normalizar(m.departamento).includes(q)) contienen.push(m)
    }

    // Los que empiezan por lo escrito van primero: buscar "cali" muestra Cali
    // antes que San Calixto.
    const todos = [...empiezan, ...contienen]
    return {
      resultados: todos.slice(0, MAX_VISIBLE),
      ocultos: Math.max(0, todos.length - MAX_VISIBLE),
    }
  }, [query])

  // Agrupado por departamento, conservando el orden de relevancia.
  const grupos = useMemo(() => {
    const map = new Map<string, Municipio[]>()
    for (const m of resultados) {
      const list = map.get(m.departamento) ?? []
      list.push(m)
      map.set(m.departamento, list)
    }
    return [...map.entries()]
  }, [resultados])

  const seleccionado = value.ciudad
    ? `${value.ciudad}${value.departamento ? ` · ${value.departamento}` : ""}`
    : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !seleccionado && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="size-4 shrink-0 opacity-50" />
            <span className="truncate">{seleccionado || placeholder}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar municipio o departamento…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              No hay municipios que coincidan con &ldquo;{query}&rdquo;.
            </CommandEmpty>

            {grupos.map(([departamento, municipios]) => (
              <CommandGroup key={departamento} heading={departamento}>
                {municipios.map((m) => {
                  const activo =
                    m.ciudad === value.ciudad &&
                    (!value.departamento || m.departamento === value.departamento)
                  return (
                    <CommandItem
                      key={`${m.departamento}-${m.ciudad}`}
                      value={`${m.departamento}-${m.ciudad}`}
                      onSelect={() => {
                        onChange({ ciudad: m.ciudad, departamento: m.departamento })
                        setQuery("")
                        setOpen(false)
                      }}
                    >
                      <span className="flex-1">{m.ciudad}</span>
                      {activo && <Check className="size-4" />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}

            {ocultos > 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {ocultos} municipio{ocultos === 1 ? "" : "s"} más. Escribe para filtrar entre los{" "}
                {MUNICIPIOS.length} de Colombia.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Verifica que una ciudad guardada exista en el catálogo. */
export function municipioValido(ciudad?: string, departamento?: string): boolean {
  if (!ciudad) return true
  return MUNICIPIOS.some(
    (m) => m.ciudad === ciudad && (!departamento || m.departamento === departamento),
  )
}

export { DEPARTAMENTOS }
