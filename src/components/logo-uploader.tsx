"use client"

import { ImageUp, Trash2 } from "lucide-react"
import { useRef, useTransition } from "react"
import { toast } from "sonner"

import { CompanyAvatar } from "@/components/company-avatar"
import { Button } from "@/components/ui/button"
import { removeCompanyLogo, uploadCompanyLogo } from "@/lib/data/companies-actions"
import type { Company } from "@/lib/store/types"

/**
 * Logo de la empresa.
 *
 * Es opcional a propósito: si no hay archivo, la empresa se identifica con sus
 * iniciales sobre el color de acento, y eso se ve igual de terminado. Por eso
 * la vista previa muestra siempre el resultado final, con logo o sin él.
 */
export function LogoUploader({ company }: { company: Company }) {
  const input = useRef<HTMLInputElement>(null)
  const [pendiente, startTransition] = useTransition()

  function subir(file: File) {
    const datos = new FormData()
    datos.set("file", file)
    startTransition(async () => {
      const r = await uploadCompanyLogo(company.id, datos)
      if (r.ok) toast.success("Logo actualizado")
      else toast.error(r.error ?? "No se pudo subir el logo.")
    })
  }

  return (
    <div className="flex items-center gap-4">
      <CompanyAvatar company={company} size={56} className="rounded-lg" />

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendiente}
            onClick={() => input.current?.click()}
          >
            <ImageUp className="size-4" />
            {pendiente ? "Subiendo…" : company.logo_url ? "Cambiar logo" : "Subir logo"}
          </Button>

          {company.logo_url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  const r = await removeCompanyLogo(company.id)
                  if (r.ok) toast.success("Logo quitado. Vuelven las iniciales.")
                  else toast.error(r.error)
                })
              }
            >
              <Trash2 className="size-4" />
              Quitar
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          PNG, JPG, WEBP o SVG, hasta 2 MB. Si no subes ninguno, se muestran las iniciales sobre
          el color de acento.
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) subir(file)
          // Se limpia para poder volver a elegir el mismo archivo si hace falta.
          e.target.value = ""
        }}
      />
    </div>
  )
}
