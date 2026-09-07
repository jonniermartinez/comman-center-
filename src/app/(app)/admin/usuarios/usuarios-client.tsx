"use client"

import { Info, KeyRound, MoreHorizontal, Pencil, RotateCcw, Trash2, UserPlus } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

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
  changeUserEmail,
  createUser,
  deleteUser,
  restoreUser,
  setUserActive,
  setUserPassword,
  setUserRole,
  updateUserProfile,
} from "@/lib/data/users-actions"
import type { UserRow } from "@/lib/data/users"
import { ROLE_LABELS, STATUS_LABELS, type UserRole } from "@/lib/store/types"

type Vista = "activos" | "eliminados"

export function UsuariosClient({ users, meId }: { users: UserRow[]; meId: string }) {
  const [vista, setVista] = useState<Vista>("activos")
  const [aEliminar, setAEliminar] = useState<UserRow | null>(null)
  const [aEditar, setAEditar] = useState<UserRow | null>(null)
  const [aClave, setAClave] = useState<UserRow | null>(null)
  const [pendiente, startTransition] = useTransition()

  const visibles = users.filter((u) => (vista === "activos" ? !u.deleted_at : !!u.deleted_at))
  const eliminados = users.filter((u) => u.deleted_at).length

  /** Ejecuta una acción del servidor y reporta el resultado en un toast. */
  function correr(
    accion: () => Promise<{ ok: boolean; error?: string }>,
    exito: string,
  ) {
    startTransition(async () => {
      const r = await accion()
      if (r.ok) toast.success(exito)
      else toast.error(r.error ?? "No se pudo completar la acción.")
    })
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Alta, contraseñas y baja de cuentas. Las empresas se asignan desde el equipo de cada una."
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
              {visibles.map((profile) => {
                const esYo = profile.id === meId
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
                          disabled={esYo || pendiente}
                          onValueChange={(v) =>
                            correr(
                              () => setUserRole(profile.id, v as UserRole),
                              `${profile.full_name} ahora es ${ROLE_LABELS[v as UserRole]}`,
                            )
                          }
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
                      {profile.companies.length
                        ? profile.companies.map((c) => c.company_name).join(", ")
                        : "—"}
                    </TableCell>

                    <TableCell className="text-right tabular-nums">{profile.registros}</TableCell>

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
                            <>
                              <DropdownMenuItem onSelect={() => setAClave(profile)}>
                                <KeyRound className="size-4" />
                                Restaurar con contraseña nueva
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  correr(
                                    () => restoreUser(profile.id),
                                    `${profile.full_name} restaurado`,
                                  )
                                }
                              >
                                <RotateCcw className="size-4" />
                                Restaurar con la que tenía
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem onSelect={() => setAEditar(profile)}>
                                <Pencil className="size-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setAClave(profile)}>
                                <KeyRound className="size-4" />
                                Definir contraseña
                              </DropdownMenuItem>
                              {profile.status === "inactivo" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      correr(
                                        () => setUserActive(profile.id, true),
                                        `${profile.full_name} activado`,
                                      )
                                    }
                                  >
                                    Activar
                                  </DropdownMenuItem>
                                </>
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

              {visibles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    {vista === "eliminados"
                      ? "No hay usuarios eliminados."
                      : "Todavía no hay usuarios. Crea el primero con «Nuevo usuario»."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>


      <EditarUsuarioDialog
        user={aEditar}
        meId={meId}
        onClose={() => setAEditar(null)}
      />

      <ClaveDialog user={aClave} onClose={() => setAClave(null)} />

      <AlertDialog open={!!aEliminar} onOpenChange={(open) => !open && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {aEliminar?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Al confirmar:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Pierde el acceso al sistema de inmediato y no puede volver a entrar.</li>
                  <li>Sale de las {aEliminar?.companies.length ?? 0} empresa(s) que tiene asignadas.</li>
                  <li>
                    Sus <strong>{aEliminar?.registros ?? 0} registro(s)</strong> históricos se
                    conservan y siguen apareciendo <strong>a su nombre</strong> en los reportes.
                  </li>
                  <li>No se podrá seleccionar como responsable de registros nuevos.</li>
                  <li>Puedes restaurarlo después desde la pestaña «Eliminados».</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!aEliminar) return
                correr(() => deleteUser(aEliminar.id), `${aEliminar.full_name} eliminado`)
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

/**
 * Alta de una cuenta: nombre, correo, teléfono, contraseña y rol. No hay
 * correo de por medio: el super admin le dicta la contraseña. Las empresas
 * se le asignan después, desde el equipo de cada una.
 */
function NuevoUsuarioDialog() {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<UserRole>("asesor")
  const [password, setPassword] = useState("")
  const [pendiente, startTransition] = useTransition()

  const valido = fullName.trim().length > 2 && /.+@.+\..+/.test(email) && password.length >= 8

  function limpiar() {
    setFullName("")
    setEmail("")
    setPhone("")
    setRole("asesor")
    setPassword("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) limpiar()
      }}
    >
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
            Entra con el correo y la contraseña que pongas acá. Dictásela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Nuñez"
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono (opcional)</Label>
            <Input
              id="telefono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 000 0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clave">Contraseña</Label>
            <Input
              id="clave"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <p className="text-xs text-muted-foreground">
              Se ve en claro para que la puedas dictar. La persona la cambia después desde su menú.
            </p>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pendiente}
            onClick={() =>
              startTransition(async () => {
                const r = await createUser({ full_name: fullName, email, phone, role, password })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo crear el usuario.")
                  return
                }
                toast.success(`${fullName} ${r.mensaje ? "listo" : "creado"}`, {
                  description: r.mensaje ?? "Ya puede entrar con esa contraseña.",
                })
                limpiar()
                setOpen(false)
              })
            }
          >
            {pendiente ? "Creando…" : "Crear usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Edición de un usuario: nombre, correo, teléfono y rol global.
 *
 * Cambiar el correo es lo que cierra el flujo de las cuentas provisionales:
 * alguien entró con un usuario terminado en `.invalid` y ahora sí mandó su
 * correo. La cuenta conserva su identificador, así que su histórico, sus
 * empresas y sus metas siguen donde estaban. Las empresas no se tocan acá:
 * quien conoce la sede es el equipo de cada empresa, y ahí está la pantalla.
 */
function EditarUsuarioDialog({
  user,
  meId,
  onClose,
}: {
  user: UserRow | null
  meId: string
  onClose: () => void
}) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<UserRole>("asesor")
  const [pendiente, startTransition] = useTransition()

  // Se resiembra el formulario cada vez que se abre con otro usuario. Se hace
  // en render y no en un efecto para no pintar un frame con los datos del
  // usuario anterior.
  const [cargado, setCargado] = useState<string | null>(null)
  if (user && cargado !== user.id) {
    setCargado(user.id)
    setFullName(user.full_name)
    setEmail(user.email)
    setPhone(user.phone ?? "")
    setRole(user.role)
  }
  if (!user && cargado !== null) setCargado(null)

  const esYo = user?.id === meId
  const valido = fullName.trim().length > 2 && /.+@.+\..+/.test(email)

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {user?.full_name}</DialogTitle>
          <DialogDescription>Datos de la cuenta y rol global.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editar-nombre">Nombre completo</Label>
            <Input
              id="editar-nombre"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editar-correo">Correo</Label>
            <Input
              id="editar-correo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Es con el que entra.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editar-telefono">Teléfono (opcional)</Label>
            <Input
              id="editar-telefono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 000 0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editar-rol">Rol global</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={esYo}>
              <SelectTrigger id="editar-rol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asesor">Asesor</SelectItem>
                <SelectItem value="coordinador">Coordinador</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            {esYo && (
              <p className="text-xs text-muted-foreground">Tu propio rol no se cambia desde acá.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pendiente || !valido}
            onClick={() =>
              startTransition(async () => {
                if (!user) return
                const datos = await updateUserProfile(user.id, { full_name: fullName, phone })
                if (!datos.ok) {
                  toast.error(datos.error)
                  return
                }
                if (email.trim().toLowerCase() !== user.email) {
                  const correo = await changeUserEmail(user.id, email)
                  if (!correo.ok) {
                    toast.error(correo.error)
                    return
                  }
                }
                if (role !== user.role && !esYo) {
                  const rol = await setUserRole(user.id, role)
                  if (!rol.ok) {
                    toast.error(rol.error)
                    return
                  }
                }
                toast.success(`${fullName} actualizado`)
                onClose()
              })
            }
          >
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Contraseña nueva para una cuenta. Es la única recuperación que hay: no se
 * manda correo. Se muestra en claro para dictarla.
 */
function ClaveDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const [password, setPassword] = useState("")
  const [pendiente, startTransition] = useTransition()

  return (
    <Dialog
      open={!!user}
      onOpenChange={(o) => {
        if (!o) {
          setPassword("")
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contraseña de {user?.full_name}</DialogTitle>
          <DialogDescription>
            {user?.deleted_at
              ? "La cuenta vuelve a tener acceso con esta contraseña. Dictásela: la puede cambiar después desde su menú."
              : "Reemplaza la que tenía. Dictásela: la puede cambiar después desde su menú."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="clave-nueva">Contraseña nueva</Label>
          <Input
            id="clave-nueva"
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pendiente || password.length < 8}
            onClick={() =>
              startTransition(async () => {
                if (!user) return
                const r = await setUserPassword(user.id, password)
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                toast.success(
                  user.deleted_at
                    ? `${user.full_name} restaurado con contraseña nueva`
                    : `Contraseña de ${user.full_name} definida`,
                )
                setPassword("")
                onClose()
              })
            }
          >
            {pendiente ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
