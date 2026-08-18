"use client"

import { Search, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Barra de filtros de los listados.
 *
 * Escribe en la URL en vez de guardar estado propio: la página vuelve a
 * consultar en el servidor con los filtros aplicados, y el enlace resultante
 * se puede compartir. Cada cambio de filtro devuelve a la página 1, porque
 * quedarse en la 7 de un resultado que ahora tiene 2 páginas confunde.
 */
export function RecordFilters({
  sedes,
  responsables,
  buscar,
}: {
  sedes?: { id: string; name: string }[]
  responsables?: { id: string; full_name: string }[]
  /** Texto del marcador de búsqueda; si no se pasa, no se muestra el campo. */
  buscar?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [texto, setTexto] = useState(params.get("q") ?? "")

  function aplicar(cambios: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (!valor || valor === "todos" || valor === "todas") next.delete(clave)
      else next.set(clave, valor)
    }
    next.delete("p")
    router.push(`${pathname}?${next.toString()}`)
  }

  const hayFiltros = ["desde", "hasta", "sede", "responsable", "q"].some((k) => params.get(k))

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {buscar && (
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            aplicar({ q: texto.trim() || undefined })
          }}
        >
          <Label htmlFor="q" className="text-xs text-muted-foreground">
            Buscar
          </Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={buscar}
              className="w-64 pl-8"
            />
          </div>
        </form>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="desde" className="text-xs text-muted-foreground">
          Desde
        </Label>
        <Input
          id="desde"
          type="date"
          defaultValue={params.get("desde") ?? ""}
          onChange={(e) => aplicar({ desde: e.target.value || undefined })}
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
          defaultValue={params.get("hasta") ?? ""}
          onChange={(e) => aplicar({ hasta: e.target.value || undefined })}
          className="w-40"
        />
      </div>

      {sedes && sedes.length > 1 && (
        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Sede</Label>
          <Select
            value={params.get("sede") ?? "todas"}
            onValueChange={(v) => aplicar({ sede: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las sedes</SelectItem>
              {sedes.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {responsables && responsables.length > 0 && (
        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Responsable</Label>
          <Select
            value={params.get("responsable") ?? "todos"}
            onValueChange={(v) => aplicar({ responsable: v })}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {responsables.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hayFiltros && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="size-4" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
