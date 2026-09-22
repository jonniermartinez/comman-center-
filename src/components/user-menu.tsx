"use client"

import { ChevronsUpDown, KeyRound, LogOut, Moon, Sun, SunMoon } from "lucide-react"
import Link from "next/link"

import { signOut } from "@/lib/auth/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initials } from "@/lib/format"
import { useCurrentUser } from "@/lib/store/hooks"
import { ROLE_LABELS } from "@/lib/store/types"
import { THEME_LABELS, type ThemePreference } from "@/lib/theme"
import { useTheme } from "@/lib/use-theme"

const THEME_ICONS = { claro: Sun, oscuro: Moon, sistema: SunMoon } as const
const THEME_OPTIONS: ThemePreference[] = ["claro", "oscuro", "sistema"]

/** Pie del sidebar: quién está en sesión, cómo se ve la app y cómo salir. */
export function UserMenu() {
  const me = useCurrentUser()
  const { preference, resolved, setPreference } = useTheme()
  const ThemeIcon = resolved === "dark" ? Moon : Sun

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

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ThemeIcon className="size-4" />
            Apariencia
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={preference}
              onValueChange={(value) => setPreference(value as ThemePreference)}
            >
              {THEME_OPTIONS.map((option) => {
                const Icon = THEME_ICONS[option]
                return (
                  <DropdownMenuRadioItem key={option} value={option}>
                    <Icon className="size-4" />
                    {THEME_LABELS[option]}
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

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
