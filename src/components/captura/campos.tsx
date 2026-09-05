"use client"

import { Combobox } from "@/components/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Contador entero. Es el campo más repetido de los formularios de captura. */
export function CampoNumero({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_5rem] items-center gap-3">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="text-right tabular-nums"
      />
    </div>
  )
}

export function CampoTexto({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

/** Lista con buscador. Todas las listas de los formularios pasan por acá. */
export function CampoSelect({
  id,
  label,
  value,
  onChange,
  options,
  vacio,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  /** Texto de la opción "sin valor". Si no se pasa, el campo es obligatorio. */
  vacio?: string
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        vacio={vacio}
        placeholder={vacio ?? "Elegir…"}
        buscar={`Buscar ${label.toLowerCase()}…`}
      />
    </div>
  )
}

/** El valor que guarda un CampoSelect opcional: "__vacio" significa null. */
export function valorOpcional(value: string): string | null {
  return !value || value === "__vacio" ? null : value
}
