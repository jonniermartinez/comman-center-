"use client"

import {
  AlertCircle,
  Building2,
  MapPin,
  Receipt,
  TrendingUp,
  ArchiveRestore,
  ArrowRight,
  CheckCircle2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { CompanyAvatar } from "@/components/company-avatar"
import { DeleteCompanyDialog } from "@/components/delete-company-dialog"
import { NoAccess } from "@/components/no-access"
import { PageHeader } from "@/components/page-header"
import { OPERATOR_NAME } from "@/lib/branding"
import { StatStrip } from "@/components/stat-strip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { formatCOPShort, formatNumber, formatPercent, todayISO } from "@/lib/format"
import { monthLabel } from "@/lib/kpi"
import { useCompanyMonthly } from "@/lib/data/client-queries"
import { archiveCompany } from "@/lib/data/companies-actions"
import { useDb, useIsSuperAdmin, useVisibleCompanies } from "@/lib/store/hooks"
import { usePeriodo } from "@/lib/store/periodo"
import type { Company } from "@/lib/store/types"

/**
 * Home del super admin: una tarjeta por empresa cliente con su avance del mes
 * y si ya registró hoy. Los demás roles ven el mismo grid pero solo con sus
 * empresas y sin acciones de administración.
 */
export default function EmpresasPage() {
  const db = useDb()
  const isSuperAdmin = useIsSuperAdmin()
  const [showArchived, setShowArchived] = useState(false)
  const companies = useVisibleCompanies(showArchived)

  const today = todayISO()
  // El mes lo manda el filtro de la barra superior, común a toda la aplicación.
  const { mes: month } = usePeriodo()
  // Los totales del mes los calcula Postgres: son 16.000 ventas y 19.000 pagos.
  const { datos: mensual } = useCompanyMonthly(month)

  const activas = new Set(companies.filter((c) => c.status === "activa").map((c) => c.id))
  const consolidado = mensual
    .filter((m) => activas.has(m.company_id))
    .reduce(
      (acc, m) => ({
        ventas: acc.ventas + Number(m.ventas_mes),
        renovaciones: acc.renovaciones + Number(m.renovaciones_mes),
        licencias: acc.licencias + Number(m.licencias_mes),
        facturacion: acc.facturacion + Number(m.facturacion_mes),
        recaudo: acc.recaudo + Number(m.recaudo_mes),
      }),
      { ventas: 0, renovaciones: 0, licencias: 0, facturacion: 0, recaudo: 0 },
    )

  // Un usuario sin empresas y sin ser super admin no ve nada: ni el grid vacío,
  // ni las métricas consolidadas. Refleja lo que RLS ya niega en la base.
  if (!isSuperAdmin && companies.length === 0) {
    return <NoAccess />
  }

  return (
    <>
      <PageHeader
        title="Empresas"
        description={`Clientes de ${OPERATOR_NAME} con sus sedes. Avance de ${monthLabel(month)} y estado de captura del ${today.slice(8, 10)}/${today.slice(5, 7)}.`}
        actions={
          <>
            {isSuperAdmin && (
              <div className="flex items-center gap-2 pr-2">
                <Switch
                  id="ver-archivadas"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                />
                <Label htmlFor="ver-archivadas" className="text-xs text-muted-foreground">
                  Ver archivadas
                </Label>
              </div>
            )}
            {isSuperAdmin && (
              <Button asChild size="sm">
                <Link href="/empresas/nueva">
                  <Plus className="size-4" />
                  Nueva empresa
                </Link>
              </Button>
            )}
          </>
        }
      />

      <StatStrip
        className="mb-6"
        items={[
          {
            label: "Ventas del mes",
            value: consolidado.ventas,
            icon: TrendingUp,
            hint: "Todas las empresas",
          },
          {
            label: "Renovaciones del mes",
            value: consolidado.renovaciones,
            icon: RefreshCw,
            hint: "Todas las empresas",
          },
          {
            label: "Licencias del mes",
            value: consolidado.licencias,
            icon: Receipt,
            hint: "Todas las empresas",
          },
          {
            label: "Facturación del mes",
            value: consolidado.facturacion,
            unit: "moneda",
            icon: Building2,
            hint: "Todas las empresas",
          },
          {
            label: "Recaudo del mes",
            value: consolidado.recaudo,
            unit: "moneda",
            icon: Building2,
            hint: "Todas las empresas",
          },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {companies.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            month={month}
            today={today}
            isSuperAdmin={isSuperAdmin}
          />
        ))}

        {isSuperAdmin && (
          <Link
            href="/empresas/nueva"
            className="flex min-h-56 flex-col items-center justify-center gap-2 border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Plus className="size-6" />
            <span className="text-sm font-medium">Crear empresa</span>
            <span className="max-w-48 text-center text-xs">
              Datos, sedes, módulos y financiaciones en 4 pasos
            </span>
          </Link>
        )}

      </section>
    </>
  )
}

function CompanyCard({
  company,
  month,
  today,
  isSuperAdmin,
}: {
  company: Company
  month: string
  today: string
  isSuperAdmin: boolean
}) {
  const db = useDb()
  const { datos: mensual } = useCompanyMonthly(month)
  const fila = mensual.find((m) => m.company_id === company.id)
  const totals = {
    ventas: Number(fila?.ventas_mes ?? 0),
    renovaciones: Number(fila?.renovaciones_mes ?? 0),
    licencias: Number(fila?.licencias_mes ?? 0),
    facturacion: Number(fila?.facturacion_mes ?? 0),
    recaudo: Number(fila?.recaudo_mes ?? 0),
  }
  const members = db.company_staff.filter((cs) => cs.company_id === company.id).length
  const sedes = db.branches.filter(
    (b) => b.company_id === company.id && b.status === "activa",
  ).length
  const modules = db.company_modules.filter((m) => m.company_id === company.id).length

  // El cumplimiento contra la meta vive en la pantalla de objetivos, donde la
  // vista `v_objective_progress` ya cruza meta y real. Acá se muestra la cifra.
  const ratioVentas: number | null = null
  const archivada = company.status === "archivada"
  const [borrando, setBorrando] = useState(false)

  return (
    <Card
      className={
        archivada
          ? "gap-0 py-0 opacity-60 transition-shadow"
          : "gap-0 py-0 transition-shadow hover:shadow-md"
      }
    >
      {/* Franja de identidad: el color de la empresa da el primer golpe de vista. */}
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: company.accent_color }} />

      <CardHeader className="pt-5">
        <div className="flex items-start gap-3">
          <CompanyAvatar company={company} size={44} className="rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">{company.name}</h2>
              {archivada && (
                <Badge variant="secondary" className="text-[10px]">
                  Archivada
                </Badge>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">
                {sedes} sede{sedes === 1 ? "" : "s"} · {members} comercial
                {members === 1 ? "" : "es"}
              </span>
            </p>
          </div>
        </div>

        {isSuperAdmin && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Acciones de {company.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/e/${company.slug}/configuracion`}>
                    <Settings className="size-4" />
                    Configuración
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {archivada ? (
                  <DropdownMenuItem
                    onSelect={async () => {
                      const r = await archiveCompany(company.id, false)
                      if (r.ok) toast.success(`${company.name} reactivada`)
                      else toast.error(r.error)
                    }}
                  >
                    <ArchiveRestore className="size-4" />
                    Reactivar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={async () => {
                      const r = await archiveCompany(company.id, true)
                      if (r.ok) {
                        toast.success(`${company.name} archivada`, {
                          description: "Los registros históricos se conservan.",
                        })
                      } else {
                        toast.error(r.error)
                      }
                    }}
                  >
                    Archivar empresa
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setBorrando(true)}>
                  <Trash2 className="size-4" />
                  Eliminar definitivamente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}

        <DeleteCompanyDialog
          companyId={company.id}
          companyName={company.name}
          open={borrando}
          onOpenChange={setBorrando}
          onDeleted={() => {}}
        />
      </CardHeader>

      <CardContent className="pt-4 pb-5">
        {/* La cifra que se busca primero, en grande. */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">Ventas de {monthLabel(month)}</span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatNumber(totals.ventas)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Renovaciones</p>
            <p className="font-medium tabular-nums">{formatNumber(totals.renovaciones)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Facturación</p>
            <p className="font-medium tabular-nums">{formatCOPShort(totals.facturacion)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recaudo</p>
            <p className="font-medium tabular-nums">{formatCOPShort(totals.recaudo)}</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t pt-4 pb-5">
        <Button asChild variant="outline" className="w-full" disabled={archivada}>
          <Link href={`/e/${company.slug}`}>
            Entrar
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
