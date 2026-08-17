"use client"

import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  History,
  LayoutGrid,
  MapPin,
  Phone,
  Receipt,
  Settings,
  Target,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { CompanySwitcher } from "@/components/company-switcher"
import { UserSwitcher } from "@/components/user-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  useCanManage,
  useCompanyBySlug,
  useCompanyModules,
  useCompanyRole,
  useIsSuperAdmin,
  useVisibleCompanies,
} from "@/lib/store/hooks"
import type { ModuleCode } from "@/lib/store/types"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Si está presente, el ítem solo aparece cuando el módulo está habilitado. */
  module?: ModuleCode
}

/**
 * Título de la página para la barra superior.
 *
 * `conAcceso` en falso significa que la ruta apunta a una empresa que el usuario
 * no puede ver: el título no debe insinuar contenido que no existe para él.
 */
function tituloDe(pathname: string, conAcceso: boolean): string {
  if (pathname.startsWith("/e/") && !conAcceso) return "Sin acceso"

  if (pathname === "/empresas") return "Empresas"
  if (pathname.startsWith("/empresas/nueva")) return "Nueva empresa"
  if (pathname.startsWith("/admin/usuarios")) return "Usuarios"
  if (pathname.startsWith("/admin/auditoria")) return "Auditoría"

  const seccion = pathname.split("/")[3]
  const titulos: Record<string, string> = {
    "kpi-diario": "KPI Diario",
    "gestion-diaria": "Gestión Diaria",
    "reporte-ventas": "Reporte de Ventas",
    objetivos: "Objetivos",
    sedes: "Sedes",
    usuarios: "Equipo",
    configuracion: "Configuración",
  }
  return titulos[seccion ?? ""] ?? "Dashboard"
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isSuperAdmin = useIsSuperAdmin()

  // La empresa activa se deduce de la URL: /e/[slug]/...
  const slug = pathname.startsWith("/e/") ? pathname.split("/")[2] : undefined
  const enRuta = useCompanyBySlug(slug ?? "")

  // La URL no otorga acceso. Si el usuario no está asignado a esa empresa, para el
  // sidebar es como si no existiera: mostrar sus módulos ya revelaría qué tiene
  // contratada, aunque no se filtre ningún dato.
  const rolEnEmpresa = useCompanyRole(enRuta?.id)
  const company = rolEnEmpresa ? enRuta : undefined

  const modules = useCompanyModules(company?.id)
  const canManage = useCanManage(company?.id)

  const base = company ? `/e/${company.slug}` : ""

  // Sin empresas visibles y sin ser super admin no hay nada que navegar: el
  // sidebar se queda solo con el pie de sesión, en línea con lo que niega RLS.
  const visibles = useVisibleCompanies()
  const sinAcceso = !isSuperAdmin && visibles.length === 0

  const capturaItems = ([
    { href: `${base}/kpi-diario`, label: "KPI Diario", icon: Phone, module: "kpi_diario" },
    { href: `${base}/gestion-diaria`, label: "Gestión Diaria", icon: ClipboardList, module: "gestion_diaria" },
    { href: `${base}/reporte-ventas`, label: "Reporte de Ventas", icon: Receipt, module: "reporte_ventas" },
  ] satisfies NavItem[]).filter((item) => !item.module || modules.includes(item.module))

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href)

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" className="border-r">
        {/* La tarjeta de empresa hace también de logo: no hay fila de marca aparte. */}
        {!sinAcceso && (
          <SidebarHeader className="px-3 pt-4 pb-2">
            <CompanySwitcher current={company} />
          </SidebarHeader>
        )}

        <SidebarContent className="gap-1 px-3">
          {!sinAcceso && (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavLink
                    href="/empresas"
                    label="Empresas"
                    icon={LayoutGrid}
                    active={pathname.startsWith("/empresas")}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {company && (
            <>
              <SidebarGroup className="p-0">
                <SidebarGroupContent>
                  <SidebarMenu>
                    <NavLink
                      href={base}
                      label="Dashboard"
                      icon={BarChart3}
                      active={pathname === base}
                    />
                    <NavLink
                      href={`${base}/objetivos`}
                      label="Objetivos"
                      icon={Target}
                      active={isActive(`${base}/objetivos`)}
                    />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {capturaItems.length > 0 && (
                <SidebarGroup className="p-0">
                  <GroupLabel>Registrar</GroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {capturaItems.map((item) => (
                        <NavLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={isActive(item.href)}
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}

              {canManage && (
                <SidebarGroup className="p-0">
                  <GroupLabel>Administrar</GroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <NavLink
                        href={`${base}/sedes`}
                        label="Sedes"
                        icon={MapPin}
                        active={isActive(`${base}/sedes`)}
                      />
                      <NavLink
                        href={`${base}/usuarios`}
                        label="Equipo"
                        icon={Users}
                        active={isActive(`${base}/usuarios`)}
                      />
                      <NavLink
                        href={`${base}/configuracion`}
                        label="Configuración"
                        icon={Settings}
                        active={isActive(`${base}/configuracion`)}
                      />
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </>
          )}

          {isSuperAdmin && (
            <SidebarGroup className="mt-auto p-0">
              <GroupLabel>Plataforma</GroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavLink
                    href="/admin/usuarios"
                    label="Usuarios"
                    icon={Users}
                    active={isActive("/admin/usuarios")}
                  />
                  <NavLink
                    href="/admin/auditoria"
                    label="Auditoría"
                    icon={History}
                    active={isActive("/admin/auditoria")}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="px-3 pb-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <UserSwitcher />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex w-full items-center gap-3 border-b bg-card px-4 py-3.5 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <h1 className="flex-1 truncate text-base font-medium sm:text-lg">
            {tituloDe(pathname, !!company)}
          </h1>
        </header>

        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </SidebarGroupLabel>
  )
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label} className="h-[38px]">
        <Link href={href}>
          <Icon className="size-[18px]" />
          <span className="text-sm">{label}</span>
          {active && (
            <ChevronRight className="ml-auto size-4 text-muted-foreground opacity-60" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
