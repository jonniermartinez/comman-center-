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
  Settings,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { NoAccess } from "@/components/no-access"
import { PageHeader } from "@/components/page-header"
import { OPERATOR_NAME } from "@/lib/branding"
import { StatStrip } from "@/components/stat-strip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
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
import { captureStatus, companyMonthTotals, monthLabel, monthOf } from "@/lib/kpi"
import { archiveCompany, restoreCompany } from "@/lib/store/actions"
import { useDb, useIsSuperAdmin, useVisibleCompanies } from "@/lib/store/hooks"
import { REFERENCE_DATE } from "@/lib/store/seed"
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

  // Mientras los datos son de demo, "hoy" es la fecha del Excel para que las
  // tarjetas no salgan vacías. Con datos reales se usa la fecha del sistema.
  const today = db.daily_kpi.some((k) => k.report_date === todayISO())
    ? todayISO()
    : REFERENCE_DATE
  const month = monthOf(today)

  const consolidado = companies
    .filter((c) => c.status === "activa")
    .reduce(
      (acc, c) => {
        const t = companyMonthTotals(db, c.id, month)
        return {
          ventas: acc.ventas + t.ventas,
          licencias: acc.licencias + t.licencias,
          facturacion: acc.facturacion + t.facturacion,
          recaudo: acc.recaudo + t.recaudo,
        }
      },
      { ventas: 0, licencias: 0, facturacion: 0, recaudo: 0 },
    )

  // Un usuario sin empresas y sin ser super admin no ve nada: ni el grid vacío,
  // ni las métricas consolidadas. Refleja lo que RLS ya niega en la base.
  if (!isSuperAdmin && companies.length === 0) {
    return <NoAccess />
  }

  const sinRegistrar = companies.filter((c) => {
    if (c.status !== "activa") return false
    const status = captureStatus(db, c.id, today)
    return status.length > 0 && status.some((s) => !s.kpi)
  }).length

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

      {sinRegistrar > 0 && (
        <div className="mb-6 flex items-center gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>
            {sinRegistrar === 1
              ? "1 empresa tiene asesores sin registrar el KPI de hoy."
              : `${sinRegistrar} empresas tienen asesores sin registrar el KPI de hoy.`}
          </span>
        </div>
      )}

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
              Datos, sedes, módulos, financiaciones y equipo en 5 pasos
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
  const totals = companyMonthTotals(db, company.id, month)
  const members = db.company_users.filter(
    (cu) => cu.company_id === company.id && !cu.removed_at,
  ).length
  const sedes = db.branches.filter(
    (b) => b.company_id === company.id && b.status === "activa",
  ).length
  const modules = db.company_modules.filter((m) => m.company_id === company.id).length

  const metaVentas = db.objectives.find(
    (o) =>
      o.company_id === company.id &&
      o.period_month === month &&
      o.metric_code === "ventas_mensuales" &&
      !o.user_id,
  )?.target_value
  const ratioVentas = metaVentas ? totals.ventas / metaVentas : null

  const status = captureStatus(db, company.id, today)
  const registrados = status.filter((s) => s.kpi).length
  const archivada = company.status === "archivada"

  return (
    <Card className={archivada ? "opacity-60" : undefined}>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-sm text-sm font-bold text-white"
          style={{ backgroundColor: company.accent_color }}
        >
          {company.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{company.name}</h2>
            {archivada && (
              <Badge variant="secondary" className="text-[10px]">
                Archivada
              </Badge>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {sedes} sede{sedes === 1 ? "" : "s"} · {members} comercial
            {members === 1 ? "" : "es"} · {modules} módulo{modules === 1 ? "" : "s"}
          </p>
        </div>

        {isSuperAdmin && (
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
                  onSelect={() => {
                    restoreCompany(company.id)
                    toast.success(`${company.name} reactivada`)
                  }}
                >
                  <ArchiveRestore className="size-4" />
                  Reactivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    archiveCompany(company.id)
                    toast.success(`${company.name} archivada`, {
                      description: "Los registros históricos se conservan.",
                    })
                  }}
                >
                  Archivar empresa
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Ventas del mes</span>
            <span className="font-semibold tabular-nums">
              {formatNumber(totals.ventas)}
              {metaVentas ? (
                <span className="text-muted-foreground"> / {formatNumber(metaVentas)}</span>
              ) : null}
            </span>
          </div>
          {ratioVentas !== null ? (
            <>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={
                    ratioVentas >= 1
                      ? "h-full bg-emerald-600"
                      : ratioVentas >= 0.6
                        ? "h-full bg-amber-500"
                        : "h-full bg-rose-500"
                  }
                  style={{ width: `${Math.min(100, ratioVentas * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatPercent(ratioVentas)} de la meta
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sin meta de ventas este mes</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Facturación</p>
            <p className="font-medium tabular-nums">{formatCOPShort(totals.facturacion)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recaudo</p>
            <p className="font-medium tabular-nums">{formatCOPShort(totals.recaudo)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-t pt-3 text-xs">
          {status.length === 0 ? (
            <span className="text-muted-foreground">Sin usuarios asignados</span>
          ) : registrados === status.length ? (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span className="text-muted-foreground">
                {registrados} de {status.length} registraron hoy
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="size-3.5 text-amber-600" />
              <span className="text-muted-foreground">
                {registrados} de {status.length} registraron hoy
              </span>
            </>
          )}
        </div>
      </CardContent>

      <CardFooter>
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
