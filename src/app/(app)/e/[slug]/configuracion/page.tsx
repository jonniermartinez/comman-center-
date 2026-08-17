"use client"

import { Archive, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { useActiveCompany } from "@/components/company-guard"
import { CityCombobox } from "@/components/city-combobox"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  archiveCompany,
  setCompanyCatalog,
  setCompanyModules,
  updateCompany,
} from "@/lib/store/actions"
import { useCanManage, useDb, useIsSuperAdmin } from "@/lib/store/hooks"
import { MODULES, type ModuleCode } from "@/lib/store/types"
import { cn } from "@/lib/utils"

const COLORES = ["#0f766e", "#7c3aed", "#b45309", "#1d4ed8", "#be123c", "#0f172a"]

export default function ConfiguracionPage() {
  const company = useActiveCompany()
  const db = useDb()
  const canManage = useCanManage(company.id)
  const isSuperAdmin = useIsSuperAdmin()
  const router = useRouter()

  const [name, setName] = useState(company.name)
  const [nit, setNit] = useState(company.nit ?? "")
  const [city, setCity] = useState(company.city ?? "")
  const [department, setDepartment] = useState(company.department ?? "")
  const [crmLabel, setCrmLabel] = useState(company.crm_label ?? "")
  const [accent, setAccent] = useState(company.accent_color)

  const modulosActivos = db.company_modules
    .filter((m) => m.company_id === company.id)
    .map((m) => m.module_code)

  const financiacionesActivas = db.company_financing_types
    .filter((f) => f.company_id === company.id && f.active)
    .map((f) => f.code)

  const mediosActivos = db.company_payment_methods
    .filter((p) => p.company_id === company.id && p.active)
    .map((p) => p.code)

  if (!canManage) {
    return (
      <Alert>
        <AlertDescription>
          La configuración de {company.name} requiere rol de coordinador o super admin.
        </AlertDescription>
      </Alert>
    )
  }

  /** Cuenta los registros que dependen de un módulo, para avisar antes de apagarlo. */
  function registrosDe(module: ModuleCode): number {
    if (module === "kpi_diario")
      return db.daily_kpi.filter((k) => k.company_id === company.id).length
    if (module === "gestion_diaria")
      return db.daily_management.filter((d) => d.company_id === company.id).length
    return db.sales_entries.filter((s) => s.company_id === company.id).length
  }

  function toggleModule(code: ModuleCode) {
    const next = modulosActivos.includes(code)
      ? modulosActivos.filter((m) => m !== code)
      : [...modulosActivos, code]
    setCompanyModules(company.id, next)
    toast.success(
      modulosActivos.includes(code) ? "Módulo deshabilitado" : "Módulo habilitado",
      {
        description: modulosActivos.includes(code)
          ? "Los registros existentes se conservan; solo desaparece del menú."
          : undefined,
      },
    )
  }

  function toggleCatalog(kind: "financing" | "payment", code: string) {
    const current = kind === "financing" ? financiacionesActivas : mediosActivos
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code]
    setCompanyCatalog(company.id, kind, next)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Configuración"
        description={`Datos, módulos y catálogos comerciales de ${company.name}.`}
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Datos de la empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nit">NIT</Label>
              <Input id="nit" value={nit} onChange={(e) => setNit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <CityCombobox
                id="city"
                value={{ ciudad: city, departamento: department }}
                onChange={(v) => {
                  setCity(v.ciudad)
                  setDepartment(v.departamento ?? "")
                }}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="crm">Nombre del CRM</Label>
              <Input id="crm" value={crmLabel} onChange={(e) => setCrmLabel(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Título del módulo de Gestión Diaria, como &ldquo;CRM - LV Unión&rdquo;.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color de acento</Label>
            <div className="flex gap-2">
              {COLORES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAccent(color)}
                  style={{ backgroundColor: color }}
                  className={cn(
                    "size-8 rounded-sm ring-offset-2 transition",
                    accent === color && "ring-2 ring-foreground",
                  )}
                  aria-label={`Color ${color}`}
                  aria-pressed={accent === color}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button
              onClick={() => {
                updateCompany(company.id, {
                  name: name.trim() || company.name,
                  nit: nit.trim() || undefined,
                  city: city.trim() || undefined,
                  department: department.trim() || undefined,
                  crm_label: crmLabel.trim() || undefined,
                  accent_color: accent,
                })
                toast.success("Datos actualizados")
              }}
            >
              <Save className="size-4" />
              Guardar cambios
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            La dirección de la empresa (<code className="font-mono">/e/{company.slug}</code>) no
            cambia al renombrarla, para no romper enlaces guardados.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Módulos habilitados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {MODULES.map((m) => {
            const activo = modulosActivos.includes(m.code)
            const registros = registrosDe(m.code)
            return (
              <label
                key={m.code}
                className={cn(
                  "flex cursor-pointer items-start gap-3 border p-3 transition-colors",
                  activo ? "border-primary bg-accent/40" : "hover:bg-accent/20",
                )}
              >
                <Checkbox
                  checked={activo}
                  onCheckedChange={() => toggleModule(m.code)}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{m.name}</span>
                  <span className="block text-xs text-muted-foreground">{m.description}</span>
                  {activo && registros > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {registros} registro(s) guardados. Deshabilitarlo solo lo oculta del menú: los
                      datos no se borran.
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financiaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {db.financing_types.map((f) => (
              <label
                key={f.code}
                className="flex cursor-pointer items-center gap-2 py-1 text-sm"
              >
                <Checkbox
                  checked={financiacionesActivas.includes(f.code)}
                  onCheckedChange={() => toggleCatalog("financing", f.code)}
                />
                {f.name}
              </label>
            ))}
            <p className="border-t pt-2 text-xs text-muted-foreground">
              Definen las filas del formulario de ventas y facturación.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medios de recaudo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {db.payment_methods.map((pm) => (
              <label
                key={pm.code}
                className="flex cursor-pointer items-center gap-2 py-1 text-sm"
              >
                <Checkbox
                  checked={mediosActivos.includes(pm.code)}
                  onCheckedChange={() => toggleCatalog("payment", pm.code)}
                />
                {pm.name}
              </label>
            ))}
            <p className="border-t pt-2 text-xs text-muted-foreground">
              Definen las filas del bloque de recaudo.
            </p>
          </CardContent>
        </Card>
      </div>

      {isSuperAdmin && company.status === "activa" && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Archivar empresa</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-sm text-muted-foreground">
              Las empresas no se borran, se archivan: desaparecen del listado activo pero todo su
              histórico se conserva y se puede reactivar.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Archive className="size-4" />
                  Archivar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Archivar {company.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sale del listado de empresas activas y nadie podrá registrar datos nuevos. Todos
                    los registros históricos se conservan y puedes reactivarla en cualquier momento
                    desde el listado con &ldquo;Ver archivadas&rdquo;.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      archiveCompany(company.id)
                      toast.success(`${company.name} archivada`)
                      router.push("/empresas")
                    }}
                  >
                    Archivar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
