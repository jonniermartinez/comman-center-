"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Rango de fechas de los listados de captura. Ambos extremos son opcionales. */
export function DateRangeFilter({
  desde,
  hasta,
  onDesde,
  onHasta,
}: {
  desde: string
  hasta: string
  onDesde: (value: string) => void
  onHasta: (value: string) => void
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="desde" className="text-xs text-muted-foreground">
          Desde
        </Label>
        <Input
          id="desde"
          type="date"
          value={desde}
          onChange={(e) => onDesde(e.target.value)}
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
          onChange={(e) => onHasta(e.target.value)}
          className="w-40"
        />
      </div>
    </>
  )
}

export function ResponsableFilter({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { id: string; full_name: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Responsable</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los responsables</SelectItem>
          {options.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
