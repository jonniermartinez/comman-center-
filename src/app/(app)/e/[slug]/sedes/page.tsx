"use client"

import {
  Archive,
  ArchiveRestore,
  MapPin,
  MoreHorizontal,
  Plus,
  Star,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { CityCombobox } from "@/components/city-combobox"
import { useActiveCompany } from "@/components/company-guard"
import { PageHeader } from "@/components/page-header"
import { SectionCard, SectionCardHeader } from "@/components/section-card"
import { StatStrip } from "@/components/stat-strip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { formatCOPShort, formatNumber, formatPercent } from "@/lib/format"
import { useBranchMonthly } from "@/lib/data/client-queries"
import {
  archiveBranch,
  createBranch,
  restoreBranch,
  setPrimaryBranch,
} from "@/lib/data/branches-actions"
import {
  useCanManage,
  useCompanyBranches,
  useCompanyMembers,
  useDb,
} from "@/lib/store/hooks"
import { usePeriodo } from "@/lib/store/periodo"

export default function SedesPage() {
  const company = useActiveCompany()
  const db = useDb()
  const canManage = useCanManage(company.id)
  const [verArchivadas, setVerArchivadas] = useState(false)
  const branches = useCompanyBranches(company.id, verArchivadas)

  const { mes: month } = usePeriodo()
  const { datos: porSede } = useBranchMonthly(company.id, month)

  if (!canManage) {
    return (
      <Alert>
        <AlertDescription>
          Gestionar las sedes de {company.name} requiere rol de coordinador o super admin.
        </AlertDescription>
      </Alert>
    )
  }

  const activas = branches.filter((b) => b.status === "activa")
  const totalComerciales = db.company_users.filter(
    (cu) => cu.company_id === company.id && !cu.removed_at,
  ).length

  return (
    <>
      <PageHeader
        title="Sedes"
        description={`Dónde opera ${company.name}. Cada comercial pertenece a una sede y el dashboard de la empresa es la suma de todas.`}
        actions={
          <>
            <div className="flex items-center gap-2 pr-1">
              <Switch
                id="ver-archivadas"
                checked={verArchivadas}
                onCheckedChange={setVerArchivadas}
              />
              <Label htmlFor="ver-archivadas" className="text-xs text-muted-foreground">
                Ver archivadas
              </Label>
            </div>
            <NuevaSedeDialog companyId={company.id} defaultCity={company.city} />
          </>
        }
      />

      <StatStrip
        className="mb-6"
        items={[
          { label: "Sedes activas", value: activas.length, icon: MapPin, hint: "En operación" },
          {
            label: "Comerciales",
            value: totalComerciales,
            icon: Users,
            hint: "En toda la empresa",
          },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {branches.map((branch) => {
          const datos = porSede.find((x) => x.branch_id === branch.id)
          const archivada = branch.status === "archivada"

          return (
            <SectionCard key={branch.id} className={archivada ? "opacity-60" : undefined}>
              <SectionCardHeader
                icon={MapPin}
                title={branch.name}
                description={
                  branch.city
                    ? `${branch.city}${branch.department ? `, ${branch.department}` : ""}`
                    : "Sin municipio definido"
                }
                actions={
                  <>
                    {branch.is_primary && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Star className="size-3" />
                        Principal
                      </Badge>
                    )}
                    {archivada && (
                      <Badge variant="outline" className="text-[10px]">
                        Archivada
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Acciones de {branch.name}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!archivada && !branch.is_primary && (
                          <DropdownMenuItem
                            onSelect={async () => {
                              const r = await setPrimaryBranch(branch.id)
                              if (r.ok) toast.success(`${branch.name} es ahora la sede principal`)
                              else toast.error(r.error)
                            }}
                          >
                            <Star className="size-4" />
                            Marcar como principal
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/e/${company.slug}/usuarios`}>
                            <Users className="size-4" />
                            Gestionar comerciales
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {archivada ? (
                          <DropdownMenuItem
                            onSelect={async () => {
                              const r = await restoreBranch(branch.id)
                              if (r.ok) toast.success(`${branch.name} reactivada`)
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
                              const r = await archiveBranch(branch.id)
                              if (r.ok) {
                                toast.success(`${branch.name} archivada`, {
                                  description: "Sus registros históricos se conservan.",
                                })
                              } else {
                                toast.error("No se puede archivar", { description: r.error })
                              }
                            }}
                          >
                            <Archive className="size-4" />
                            Archivar sede
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                }
              />

              <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
                <Dato label="Comerciales" value={formatNumber(datos?.comerciales ?? 0)} />
                <Dato label="Ventas del mes" value={formatNumber(datos?.ventas_mes ?? 0)} />
                <Dato
                  label="Facturación"
                  value={formatCOPShort(datos?.facturacion_mes ?? 0)}
                />
                <Dato
                  label="Contactabilidad"
                  value={formatPercent(datos?.ratio_contactabilidad ?? null)}
                />
              </div>

              <BranchTeam companyId={company.id} branchId={branch.id} />
            </SectionCard>
          )
        })}
      </div>
    </>
  )
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** Chips con los comerciales de la sede, como en el diagrama. */
function BranchTeam({ companyId, branchId }: { companyId: string; branchId: string }) {
  const members = useCompanyMembers(companyId, branchId)

  return (
    <div className="mt-4 border-t pt-4">
      <p className="mb-2 text-xs text-muted-foreground">
        {members.length} comercial{members.length === 1 ? "" : "es"}
      </p>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin comerciales asignados a esta sede todavía.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <span
              key={m.id}
              className="flex items-center gap-1.5 rounded-full border bg-card py-1 pr-2.5 pl-1 text-sm"
            >
              <span
                aria-hidden
                className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold"
              >
                {m.full_name.slice(0, 1)}
              </span>
              {m.full_name.split(" ")[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function NuevaSedeDialog({
  companyId,
  defaultCity,
}: {
  companyId: string
  defaultCity?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [city, setCity] = useState(defaultCity ?? "")
  const [department, setDepartment] = useState("")

  const valido = name.trim().length > 1

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Nueva sede
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva sede</DialogTitle>
          <DialogDescription>
            Los comerciales se asignan a la sede después, desde Equipo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la sede</Label>
            <Input
              id="nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sede Tuluá"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="municipio">Municipio</Label>
            <CityCombobox
              id="municipio"
              value={{ ciudad: city, departamento: department }}
              onChange={(v) => {
                setCity(v.ciudad)
                setDepartment(v.departamento ?? "")
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido}
            onClick={async () => {
              const r = await createBranch({ company_id: companyId, name, city, department })
              if (!r.ok) {
                toast.error(r.error)
                return
              }
              toast.success(`Sede ${name} creada`)
              setName("")
              setOpen(false)
            }}
          >
            Crear sede
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
