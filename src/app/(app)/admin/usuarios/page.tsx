"use client"

import { Info, MoreHorizontal, RotateCcw, Trash2, UserPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

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
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/section-card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, initials } from "@/lib/format"
import {
  createUser,
  restoreUser,
  setUserStatus,
  softDeleteUser,
  updateUser,
} from "@/lib/store/actions"
import { useCurrentUser, useDb, useIsSuperAdmin } from "@/lib/store/hooks"
import {
  ROLE_LABELS,
  STATUS_LABELS,
  type Profile,
  type UserRole,
} from "@/lib/store/types"

type Vista = "activos" | "eliminados"

export default function AdminUsuariosPage() {
  const db = useDb()
  const me = useCurrentUser()
  const isSuperAdmin = useIsSuperAdmin()

  const [vista, setVista] = useState<Vista>("activos")
  const [aEliminar, setAEliminar] = useState<Profile | null>(null)

  if (!isSuperAdmin) {
    return (
      <Alert>
        <Info />
        <AlertDescription>
          La gestión de cuentas es exclusiva del super admin. Cambia de usuario en el menú de abajo
          a la izquierda para probarlo.
        </AlertDescription>
      </Alert>
    )
  }

  const usuarios = db.profiles
    .filter((p) => (vista === "activos" ? !p.deleted_at : !!p.deleted_at))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  const eliminados = db.profiles.filter((p) => p.deleted_at).length

  function registrosDe(userId: string) {
    return (
      db.daily_kpi.filter((k) => k.user_id === userId).length +
      db.daily_management.filter((d) => d.user_id === userId).length
    )
  }

  function empresasDe(userId: string) {
    return db.company_users
      .filter((cu) => cu.user_id === userId && !cu.removed_at)
      .map((cu) => db.companies.find((c) => c.id === cu.company_id)?.name)
      .filter(Boolean) as string[]
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Alta, habilitación y baja de cuentas. No hay registro público: los usuarios los crea el super admin."
        actions={
          <>
            <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
              <TabsList>
                <TabsTrigger value="activos">Activos</TabsTrigger>
                <TabsTrigger value="eliminados">
                  Eliminados{eliminados > 0 ? ` (${eliminados})` : ""}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <NuevoUsuarioDialog />
          </>
        }
      />

      <Alert className="mb-4">
        <Info />
        <AlertDescription>
          Al eliminar un usuario se le revoca el acceso, pero <strong>sus datos permanecen en el
          sistema con su nombre</strong>: los registros históricos y los reportes siguen mostrando
          quién los hizo. Un usuario eliminado no se puede seleccionar para registros nuevos y se
          puede restaurar.
        </AlertDescription>
      </Alert>

      <SectionCard>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol global</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Empresas</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((profile) => {
                const registros = registrosDe(profile.id)
                const empresas = empresasDe(profile.id)
                const esYo = profile.id === me.id
                const eliminado = !!profile.deleted_at

                return (
                  <TableRow key={profile.id} className={eliminado ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7 rounded-sm">
                          <AvatarFallback className="rounded-sm text-[10px]">
                            {initials(profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {profile.full_name}
                            {eliminado && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                (eliminado)
                              </span>
                            )}
                            {esYo && (
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                — tú
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {eliminado ? (
                        <span className="text-sm text-muted-foreground">
                          {ROLE_LABELS[profile.role]}
                        </span>
                      ) : (
                        <Select
                          value={profile.role}
                          disabled={esYo}
                          onValueChange={(v) => {
                            updateUser(profile.id, { role: v as UserRole })
                            toast.success(
                              `${profile.full_name} ahora es ${ROLE_LABELS[v as UserRole]}`,
                            )
                          }}
                        >
                          <SelectTrigger size="sm" className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="coordinador">Coordinador</SelectItem>
                            <SelectItem value="asesor">Asesor</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          profile.status === "activo"
                            ? "default"
                            : profile.status === "eliminado"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {STATUS_LABELS[profile.status]}
                      </Badge>
                      {eliminado && profile.deleted_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(profile.deleted_at.slice(0, 10))}
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {empresas.length ? empresas.join(", ") : "—"}
                    </TableCell>

                    <TableCell className="text-right tabular-nums">{registros}</TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Acciones</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {eliminado ? (
                            <DropdownMenuItem
                              onSelect={() => {
                                restoreUser(profile.id)
                                toast.success(`${profile.full_name} restaurado`)
                              }}
                            >
                              <RotateCcw className="size-4" />
                              Restaurar acceso
                            </DropdownMenuItem>
                          ) : (
                            <>
                              {profile.status === "activo" ? (
                                <DropdownMenuItem
                                  disabled={esYo}
                                  onSelect={() => {
                                    setUserStatus(profile.id, "inactivo")
                                    toast.success(`${profile.full_name} suspendido`)
                                  }}
                                >
                                  Suspender acceso
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setUserStatus(profile.id, "activo")
                                    toast.success(`${profile.full_name} activado`)
                                  }}
                                >
                                  Activar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={esYo}
                                onSelect={() => setAEliminar(profile)}
                              >
                                <Trash2 className="size-4" />
                                Eliminar usuario
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}

              {usuarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    {vista === "eliminados"
                      ? "No hay usuarios eliminados."
                      : "No hay usuarios activos."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {/* Confirmación de baja lógica */}
      <AlertDialog open={!!aEliminar} onOpenChange={(open) => !open && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {aEliminar?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Al confirmar:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Pierde el acceso al sistema de inmediato y no puede volver a entrar.</li>
                  <li>Sale de las {empresasDe(aEliminar?.id ?? "").length} empresa(s) que tiene asignadas.</li>
                  <li>
                    Sus <strong>{registrosDe(aEliminar?.id ?? "")} registro(s)</strong> históricos se
                    conservan y siguen apareciendo <strong>a su nombre</strong> en los reportes.
                  </li>
                  <li>No se podrá seleccionar como responsable de registros nuevos.</li>
                  <li>Puedes restaurarlo después desde la pestaña &ldquo;Eliminados&rdquo;.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!aEliminar) return
                const result = softDeleteUser(aEliminar.id)
                if (result.ok) {
                  toast.success(`${aEliminar.full_name} eliminado`, {
                    description: "Su histórico se conserva en el sistema con su nombre.",
                  })
                } else {
                  toast.error(result.error)
                }
                setAEliminar(null)
              }}
            >
              Eliminar usuario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function NuevoUsuarioDialog() {
  const db = useDb()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("asesor")
  const [companies, setCompanies] = useState<string[]>([])

  const activas = db.companies.filter((c) => c.status === "activa")
  const emailDuplicado = db.profiles.some(
    (p) => p.email.toLowerCase() === email.trim().toLowerCase(),
  )
  const valido = fullName.trim().length > 2 && /.+@.+\..+/.test(email) && !emailDuplicado

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            Se crea en estado &ldquo;invitado&rdquo; y queda activo cuando define su contraseña
            desde el correo de invitación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nuñez Juan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan.nunez@tramitesbuga.co"
              aria-invalid={emailDuplicado}
            />
            {emailDuplicado && (
              <p className="text-xs text-destructive">Ya existe un usuario con ese correo.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rol">Rol global</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="rol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asesor">Asesor</SelectItem>
                <SelectItem value="coordinador">Coordinador</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role !== "super_admin" && (
            <div className="space-y-2">
              <Label>Empresas asignadas</Label>
              <div className="space-y-1.5">
                {activas.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={companies.includes(c.id)}
                      onCheckedChange={() =>
                        setCompanies((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((x) => x !== c.id)
                            : [...prev, c.id],
                        )
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Entra con el mismo rol en todas. Se puede ajustar por empresa después.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido}
            onClick={() => {
              createUser({
                full_name: fullName,
                email,
                role,
                assignments:
                  role === "super_admin"
                    ? []
                    : companies.map((company_id) => ({
                        company_id,
                        role: role === "coordinador" ? "coordinador" : "asesor",
                      })),
              })
              toast.success(`${fullName} creado`, {
                description: "Se envió la invitación por correo.",
              })
              setFullName("")
              setEmail("")
              setCompanies([])
              setOpen(false)
            }}
          >
            Crear e invitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
