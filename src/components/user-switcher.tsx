"use client"

import { ChevronsUpDown, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initials } from "@/lib/format"
import { setCurrentUser } from "@/lib/store/actions"
import { resetDatabase } from "@/lib/store/db"
import { useCurrentUser, useDb } from "@/lib/store/hooks"
import { ROLE_LABELS } from "@/lib/store/types"

/**
 * Fila de usuario al pie del sidebar. Mientras no hay Supabase Auth también
 * hace de login: permite ver la app con los ojos de cada rol.
 */
export function UserSwitcher() {
  const db = useDb()
  const me = useCurrentUser()

  const selectable = db.profiles.filter((p) => !p.deleted_at)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent data-[state=open]:bg-accent"
        >
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initials(me.full_name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{me.full_name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {ROLE_LABELS[me.role]}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Sin login todavía: cambia de usuario para ver la app con cada rol.
        </DropdownMenuLabel>
        {selectable.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            onSelect={() => setCurrentUser(profile.id)}
            className="gap-2"
          >
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px]">
                {initials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate">{profile.full_name}</span>
            <Badge variant={profile.id === me.id ? "default" : "outline"} className="text-[10px]">
              {ROLE_LABELS[profile.role]}
            </Badge>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            resetDatabase()
            toast.success("Datos restablecidos", {
              description: "Se volvió al estado inicial del Excel (15/08/2026).",
            })
          }}
        >
          <RotateCcw className="size-4" />
          Restablecer datos de prueba
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
