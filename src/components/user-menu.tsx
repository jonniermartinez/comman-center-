"use client"

import { ChevronsUpDown, KeyRound, LogOut } from "lucide-react"
import Link from "next/link"

import { signOut } from "@/lib/auth/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initials } from "@/lib/format"
import { useCurrentUser } from "@/lib/store/hooks"
import { ROLE_LABELS } from "@/lib/store/types"

/** Pie del sidebar: quién está en sesión y cómo salir. */
export function UserMenu() {
  const me = useCurrentUser()

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

      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{me.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{me.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/definir-clave">
            <KeyRound className="size-4" />
            Cambiar contraseña
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <form action={signOut}>
          <button type="submit" className="w-full">
            <DropdownMenuItem asChild>
              <span className="cursor-pointer">
                <LogOut className="size-4" />
                Cerrar sesión
              </span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
