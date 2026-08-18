"use client"

import { Info, Link2, MapPin, Trash2, UserPlus } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { useActiveCompany } from "@/components/company-guard"
import { CrearCuentasDialog } from "@/components/crear-cuentas-dialog"
import { PageHeader } from "@/components/page-header"
import { SectionCard } from "@/components/section-card"
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
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  addStaffToCompany,
  linkStaffToProfile,
  removeStaffFromCompany,
  setStaffBranch,
} from "@/lib/data/staff-actions"
import { initials } from "@/lib/format"
import {
  useCanManage,
  useCompanyBranches,
  useCompanyMembers,
  useDb,
  useIsSuperAdmin,
} from "@/lib/store/hooks"

/**
 * Equipo de la empresa.
 *
 * Son personas, no cuentas de usuario. La mayoría del equipo nunca va a entrar
 * a la aplicación —en el histórico son 128 comerciales— pero todos tienen que
 * poder figurar como responsables de una venta o una jornada. Quien sí necesite
 * entrar se enlaza con su cuenta desde acá.
 */
export default function EquipoPage() {
  const company = useActiveCompany()
  const db = useDb()
  const branches = useCompanyBranches(company.id)
  const members = useCompanyMembers(company.id)
  const canManage = useCanManage(company.id)
  const isSuperAdmin = useIsSuperAdmin()

  const [aQuitar, setAQuitar] = useState<{ id: string; full_name: string } | null>(null)
  const [, startTransition] = useTransition()

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) {
    startTransition(async () => {
      const r = await accion()
      if (r.ok) toast.success(exito)
      else toast.error(r.error ?? "No se pudo completar la acción.")
    })
  }

  if (!canManage) {
    return (
      <Alert>
        <Info />
        <AlertDescription>
          El equipo lo administra un coordinador o el super admin.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <PageHeader
        title="Equipo"
        description={`Comerciales de ${company.name}. Cada uno pertenece a una sede: es donde quedan sus registros.`}
        actions={
          <>
            {isSuperAdmin && (
              <CrearCuentasDialog
                companyId={company.id}
                pendientes={members.filter((m) => !m.profile_id).length}
              />
            )}
            <NuevoComercialDialog companyId={company.id} branches={branches} />
          </>
        }
      />

      <Alert className="mb-4">
        <Info />
        <AlertDescription>
          Un comercial existe tenga o no cuenta de acceso. Quitarlo del equipo no borra nada: sus
          ventas y sus jornadas siguen en el sistema a su nombre.
        </AlertDescription>
      </Alert>

      <SectionCard>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comercial</TableHead>
                <TableHead className="w-52">Sede</TableHead>
                <TableHead className="w-64">Cuenta de acceso</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const cuenta = db.profiles.find((p) => p.id === m.profile_id)
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7 rounded-sm">
                          <AvatarFallback className="rounded-sm text-[10px]">
                            {initials(m.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm font-medium">{m.full_name}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={m.branchId ?? "empresa"}
                        onValueChange={(v) =>
                          correr(
                            () =>
                              setStaffBranch(company.id, m.id, v === "empresa" ? null : v),
                            `${m.full_name} movido de sede`,
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="empresa">Toda la empresa</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      {isSuperAdmin ? (
                        <Select
                          value={m.profile_id ?? "ninguna"}
                          onValueChange={(v) =>
                            correr(
                              () => linkStaffToProfile(m.id, v === "ninguna" ? null : v),
                              v === "ninguna"
                                ? `${m.full_name} quedó sin cuenta enlazada`
                                : `${m.full_name} enlazado con su cuenta`,
                            )
                          }
                        >
                          <SelectTrigger size="sm" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ninguna">Sin cuenta</SelectItem>
                            {db.profiles
                              .filter((p) => !p.deleted_at)
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.full_name} · {p.email}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : cuenta ? (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <Link2 className="size-3" />
                          {cuenta.email}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin cuenta</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setAQuitar({ id: m.id, full_name: m.full_name })}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Quitar a {m.full_name} del equipo</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}

              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    {company.name} todavía no tiene comerciales. Agrega el primero.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <AlertDialog open={!!aQuitar} onOpenChange={(o) => !o && setAQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {aQuitar?.full_name} del equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer como responsable para registros nuevos de {company.name}. Sus
              ventas y jornadas anteriores se conservan a su nombre y siguen contando en los
              reportes. Puedes volver a agregarlo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!aQuitar) return
                correr(
                  () => removeStaffFromCompany(company.id, aQuitar.id),
                  `${aQuitar.full_name} salió del equipo`,
                )
                setAQuitar(null)
              }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function NuevoComercialDialog({
  companyId,
  branches,
}: {
  companyId: string
  branches: { id: string; name: string }[]
}) {
  const db = useDb()
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [existente, setExistente] = useState("nuevo")
  const [sede, setSede] = useState(branches[0]?.id ?? "")
  const [pendiente, startTransition] = useTransition()

  // Personas que ya están en el sistema por otra empresa: reutilizarlas evita
  // tener a la misma persona dos veces con métricas partidas.
  const yaEnEmpresa = new Set(
    db.company_staff.filter((cs) => cs.company_id === companyId).map((cs) => cs.staff_id),
  )
  const disponibles = db.staff.filter((s) => s.active && !yaEnEmpresa.has(s.id))

  const valido = existente !== "nuevo" || nombre.trim().length > 2

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" />
          Agregar comercial
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar comercial</DialogTitle>
          <DialogDescription>
            Puede ser alguien nuevo o alguien que ya trabaja en otra empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Persona</Label>
            <Select value={existente} onValueChange={setExistente}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nuevo">Alguien nuevo</SelectItem>
                {disponibles.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {existente === "nuevo" && (
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Apellido Nombre"
              />
              <p className="text-xs text-muted-foreground">
                Como se escribe en los reportes: apellido primero, igual que en el Excel.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sede">
              <MapPin className="size-3.5" />
              Sede
            </Label>
            <Select value={sede} onValueChange={setSede}>
              <SelectTrigger id="sede" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pendiente}
            onClick={() =>
              startTransition(async () => {
                const r = await addStaffToCompany({
                  company_id: companyId,
                  branch_id: sede || null,
                  staff_id: existente === "nuevo" ? undefined : existente,
                  full_name: existente === "nuevo" ? nombre : undefined,
                })
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                toast.success("Comercial agregado")
                setNombre("")
                setExistente("nuevo")
                setOpen(false)
              })
            }
          >
            {pendiente ? "Agregando…" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
