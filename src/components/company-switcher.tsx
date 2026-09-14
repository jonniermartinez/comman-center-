"use client"

import { Building2, Check, ChevronsUpDown, LayoutGrid, Plus, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { CompanyAvatar } from "@/components/company-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDb, useIsSuperAdmin, useVisibleCompanies } from "@/lib/store/hooks"
import type { Company } from "@/lib/store/types"

/**
 * Tarjeta de empresa activa en la cabecera del sidebar, al estilo del selector
 * de workspace del template: caja con borde, logo, nombre y conteo de equipo.
 */
export function CompanySwitcher({ current }: { current?: Company }) {
  const db = useDb()
  const companies = useVisibleCompanies()
  const isSuperAdmin = useIsSuperAdmin()
  const router = useRouter()

  const miembros = current
    ? db.company_users.filter((cu) => cu.company_id === current.id && !cu.removed_at).length
    : companies.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/40 data-[state=open]:bg-accent/40"
        >
          {current ? (
            // Placa apaisada, no cuadrada: estos logos llevan el nombre escrito al
            // lado del dibujo y en un cuadrado de 34 px no se lee ninguno.
            <CompanyAvatar company={current} size={34} width={52} className="rounded-lg" />
          ) : (
            // El símbolo del software, cuando no hay empresa activa.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/command-center-simbolo.png"
              alt=""
              width={34}
              height={34}
              className="size-[34px] shrink-0 rounded-lg border bg-white p-0.5"
            />
          )}

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {current?.name ?? "Command Center"}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              {current ? (
                <>
                  <Users className="size-3.5" />
                  <span className="text-xs">
                    {miembros} comercial{miembros === 1 ? "" : "es"}
                  </span>
                </>
              ) : (
                <>
                  <Building2 className="size-3.5" />
                  <span className="text-xs">
                    {companies.length} empresa{companies.length === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </span>
          </span>

          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Empresas cliente
        </DropdownMenuLabel>
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onSelect={() => router.push(`/e/${company.slug}`)}
            className="gap-2"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: company.accent_color }}
            />
            <span className="flex-1 truncate">{company.name}</span>
            {company.id === current?.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/empresas">
            <LayoutGrid className="size-4" />
            Ver todas las empresas
          </Link>
        </DropdownMenuItem>
        {isSuperAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/empresas/nueva">
              <Plus className="size-4" />
              Crear empresa
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
