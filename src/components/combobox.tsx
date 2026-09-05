"use client"

import { Check, ChevronsUpDown } from "lucide-react"
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
import { normalizar } from "@/lib/colombia"
import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
}

/**
 * Lista desplegable con buscador.
 *
 * Reemplaza al Select en los formularios: con tres opciones da igual, pero
 * con cuarenta comerciales o veinte sedes hay que poder escribir "gar" y
 * llegar. El filtro ignora tildes y mayúsculas, como el de municipios.
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = "Elegir…",
  buscar = "Buscar…",
  vacio,
  disabled,
  size,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  /** Texto del cuadro de búsqueda. */
  buscar?: string
  /** Opción "sin valor". Si se pasa, aparece de primera con el valor "__vacio". */
  vacio?: string
  disabled?: boolean
  size?: "sm" | "default"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const todas = useMemo<ComboboxOption[]>(
    () => (vacio ? [{ value: "__vacio", label: vacio }, ...options] : options),
    [options, vacio],
  )

  const resultados = useMemo(() => {
    const q = normalizar(query.trim())
    if (!q) return todas
    const empiezan: ComboboxOption[] = []
    const contienen: ComboboxOption[] = []
    for (const o of todas) {
      const etiqueta = normalizar(o.label)
      if (etiqueta.startsWith(q)) empiezan.push(o)
      else if (etiqueta.includes(q)) contienen.push(o)
    }
    return [...empiezan, ...contienen]
  }, [todas, query])

  const seleccionada = todas.find((o) => o.value === value)
  // La opción vacía se muestra como si no hubiera nada elegido.
  const texto = seleccionada && seleccionada.value !== "__vacio" ? seleccionada.label : ""

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          size={size === "sm" ? "sm" : "default"}
          className={cn(
            "w-full justify-between font-normal",
            !texto && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{texto || (vacio && seleccionada ? vacio : placeholder)}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-48 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={buscar} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nada coincide con &ldquo;{query}&rdquo;.</CommandEmpty>
            <CommandGroup>
              {resultados.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => {
                    onChange(o.value)
                    setQuery("")
                    setOpen(false)
                  }}
                  className={o.value === "__vacio" ? "text-muted-foreground" : undefined}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.value === value && <Check className="size-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
