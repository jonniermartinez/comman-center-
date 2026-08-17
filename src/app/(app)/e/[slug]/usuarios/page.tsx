"use client"

import { UserMinus, UserPlus, Users } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { useActiveCompany } from "@/components/company-guard"
import { PageHeader } from "@/components/page-header"
import { SectionCard, SectionCardHeader } from "@/components/section-card"
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
import { initials } from "@/lib/format"
import { assignUserToCompany, unassignUserFromCompany } from "@/lib/store/actions"
import {
  useCanManage,
  useCompanyBranches,
  useCompanyMembers,
  useDb,
} from "@/lib/store/hooks"
import { ROLE_LABELS, STATUS_LABELS, type UserRole } from "@/lib/store/types"

export default function UsuariosEmpresaPage() {
  const company = useActiveCompany()
  const db = useDb()
  const members = useCompanyMembers(company.id)
  const branches = useCompanyBranches(company.id)
  const canManage = useCanManage(company.id)

  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState("")
  const [role, setRole] = useState<Exclude<UserRole, "super_admin">>("asesor")
  const [branch, setBranch] = useState(
    () => branches.find((b) => b.is_primary)?.id ?? branches[0]?.id ?? "",
  )

  // Solo se pueden asignar usuarios activos o invitados que no estén ya en la empresa.
  const disponibles = db.profiles.filter(
    (p) =>
      !p.deleted_at &&
      p.role !== "super_admin" &&
      !members.some((m) => m.id === p.id),
  )

  if (!canManage) {
    return (
      <Alert>
        <AlertDescription>
          Gestionar usuarios de {company.name} requiere rol de coordinador o super admin.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <PageHeader
        title="Equipo"
        description={`Comerciales de ${company.name}, su sede y su rol. Los usuarios se crean en el módulo de plataforma y acá se asignan a una sede.`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={disponibles.length === 0}>
                <UserPlus className="size-4" />
                Asignar usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Asignar usuario a {company.name}</DialogTitle>
                <DialogDescription>
                  El usuario podrá ver esta empresa y registrar sus formularios.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="usuario">Usuario</Label>
                  <Select value={pick} onValueChange={setPick}>
                    <SelectTrigger id="usuario">
                      <SelectValue placeholder="Elige un usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      {disponibles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} · {p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sede">Sede</Label>
                  <Select
                    value={role === "coordinador" ? branch || "empresa" : branch}
                    onValueChange={setBranch}
                  >
                    <SelectTrigger id="sede">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                          {b.is_primary ? " · principal" : ""}
                        </SelectItem>
                      ))}
                      {role === "coordinador" && (
                        <SelectItem value="empresa">Toda la empresa</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    El asesor registra en su sede. Un coordinador puede supervisar toda la empresa.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rol">Rol en esta empresa</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as Exclude<UserRole, "super_admin">)}
                  >
                    <SelectTrigger id="rol">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asesor">
                        Asesor — llena sus formularios y ve sus KPIs
                      </SelectItem>
                      <SelectItem value="coordinador">
                        Coordinador — ve todo y define objetivos
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={!pick}
                  onClick={() => {
                    const sedeId = branch === "empresa" ? null : branch
                    assignUserToCompany(company.id, pick, role, sedeId)
                    const nombre = db.profiles.find((p) => p.id === pick)?.full_name
                    const sedeNombre = branches.find((b) => b.id === sedeId)?.name
                    toast.success(`${nombre} asignado a ${company.name}`, {
                      description: sedeNombre ?? "Supervisa toda la empresa",
                    })
                    setPick("")
                    setOpen(false)
                  }}
                >
                  Asignar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <SectionCard>
        <SectionCardHeader
          icon={Users}
          title={`${members.length} comercial${members.length === 1 ? "" : "es"}`}
          description={`${branches.length} sede${branches.length === 1 ? "" : "s"}`}
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Rol en la empresa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const registros =
                  db.daily_kpi.filter(
                    (k) => k.company_id === company.id && k.user_id === member.id,
                  ).length +
                  db.daily_management.filter(
                    (d) => d.company_id === company.id && d.user_id === member.id,
                  ).length

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7 rounded-sm">
                          <AvatarFallback className="rounded-sm text-[10px]">
                            {initials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{member.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.branchId ?? "empresa"}
                        onValueChange={(v) =>
                          assignUserToCompany(
                            company.id,
                            member.id,
                            member.companyRole,
                            v === "empresa" ? null : v,
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                          {member.companyRole === "coordinador" && (
                            <SelectItem value="empresa">Toda la empresa</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={member.companyRole}
                        onValueChange={(v) =>
                          assignUserToCompany(
                            company.id,
                            member.id,
                            v as Exclude<UserRole, "super_admin">,
                            member.branchId,
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asesor">Asesor</SelectItem>
                          <SelectItem value="coordinador">Coordinador</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === "activo" ? "default" : "outline"}>
                        {STATUS_LABELS[member.status]}
                      </Badge>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {ROLE_LABELS[member.role]} global
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{registros}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <UserMinus className="size-4" />
                            <span className="sr-only">Quitar de la empresa</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              ¿Quitar a {member.full_name} de {company.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Deja de ver esta empresa y de poder registrar en ella. Sus{" "}
                              {registros} registro(s) históricos se conservan a su nombre y siguen
                              apareciendo en los reportes. Puedes volver a asignarlo cuando quieras.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                unassignUserFromCompany(company.id, member.id)
                                toast.success(`${member.full_name} quitado de ${company.name}`)
                              }}
                            >
                              Quitar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                )
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Sin usuarios asignados. Usa &ldquo;Asignar usuario&rdquo; o{" "}
                    <Link href="/admin/usuarios" className="underline">
                      crea uno nuevo
                    </Link>
                    .
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </>
  )
}
