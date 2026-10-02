"use client"

import { Plus } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  addCompanySchool,
  listCompanySchools,
  setCompanySchoolActive,
} from "@/lib/data/companies-actions"

type Escuela = { code: string; name: string; active: boolean }

/**
 * Las escuelas de la empresa: las que se ofrecen al registrar una venta.
 *
 * Cada empresa tiene su lista (057). Se agregan escribiendo el nombre y se
 * apagan con la casilla; no se borran, porque las ventas ya registradas las
 * siguen nombrando.
 */
export function EscuelasEmpresa({ companyId, editable }: { companyId: string; editable: boolean }) {
  const [escuelas, setEscuelas] = useState<Escuela[] | null>(null)
  const [nombre, setNombre] = useState("")
  const [pendiente, startTransition] = useTransition()

  useEffect(() => {
    let vigente = true
    listCompanySchools(companyId).then((lista) => {
      if (vigente) setEscuelas(lista)
    })
    return () => {
      vigente = false
    }
  }, [companyId])

  const recargar = async () => setEscuelas(await listCompanySchools(companyId))

  function agregar() {
    const limpio = nombre.trim()
    if (!limpio) return
    startTransition(async () => {
      const r = await addCompanySchool(companyId, limpio)
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo agregar la escuela.")
        return
      }
      toast.success(`Escuela agregada: ${limpio}`)
      setNombre("")
      await recargar()
    })
  }

  function alternar(e: Escuela) {
    startTransition(async () => {
      const r = await setCompanySchoolActive(companyId, e.code, !e.active)
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo cambiar la escuela.")
        return
      }
      await recargar()
    })
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">Escuelas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {escuelas === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : escuelas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta empresa todavía no tiene escuelas. Agrega la primera abajo.
          </p>
        ) : (
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {escuelas.map((e) => (
              <label key={e.code} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <Checkbox
                  checked={e.active}
                  disabled={!editable || pendiente}
                  onCheckedChange={() => alternar(e)}
                />
                <span className={e.active ? "" : "text-muted-foreground line-through"}>{e.name}</span>
              </label>
            ))}
          </div>
        )}

        {editable && (
          <form
            className="flex flex-wrap items-center gap-2 border-t pt-3"
            onSubmit={(ev) => {
              ev.preventDefault()
              agregar()
            }}
          >
            <Input
              value={nombre}
              onChange={(ev) => setNombre(ev.target.value)}
              placeholder="Nombre de la escuela"
              aria-label="Nombre de la escuela nueva"
              className="w-64"
              disabled={pendiente}
            />
            <Button type="submit" variant="outline" disabled={pendiente || !nombre.trim()}>
              <Plus className="size-4" />
              Agregar escuela
            </Button>
          </form>
        )}

        <p className="border-t pt-2 text-xs text-muted-foreground">
          Son las opciones del campo Escuela al registrar una venta. Desmarcar una la quita de las
          ventas nuevas; las que ya la tienen la conservan.
        </p>
      </CardContent>
    </Card>
  )
}
