"use client"

import { AtSign, Info, KeyRound, MoreHorizontal, Pencil, RotateCcw, Trash2, UserPlus } from "lucide-react"
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
  changeUserEmail,
  deleteUser,
  inviteUser,
  resetUserPassword,
  restoreUser,
  setUserActive,
  setUserCompanies,
  setUserRole,
  updateUserProfile,
} from "@/lib/data/users-actions"
import type { UserRow } from "@/lib/data/users"
import { ROLE_LABELS, STATUS_LABELS, type UserRole } from "@/lib/store/types"

type Vista = "activos" | "eliminados"
type Empresa = { id: string; name: string; slug: string }

export function UsuariosClient({
  users,
  companies,
  meId,
}: {
  users: UserRow[]
  companies: Empresa[]
  meId: string
}) {
  const [vista, setVista] = useState<Vista>("activos")
  const [aEliminar, setAEliminar] = useState<UserRow | null>(null)
  const [aEditar, setAEditar] = useState<UserRow | null>(null)
  const [aCambiarCorreo, setACambiarCorreo] = useState<UserRow | null>(null)
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
            <NuevoUsuarioDialog companies={companies} />
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
                            <DropdownMenuItem
                              onSelect={() =>
                                correr(
                                  () => restoreUser(profile.id),
                                  `${profile.full_name} restaurado`,
                                )
                              }
                            >
                              <RotateCcw className="size-4" />
                              Restaurar acceso
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onSelect={() => setAEditar(profile)}>
                                <Pencil className="size-4" />
                                Editar y asignar empresas
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setACambiarCorreo(profile)}>
                                <AtSign className="size-4" />
                                Cambiar correo
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  startTransition(async () => {
                                    const r = await resetUserPassword(profile.id)
                                    if (!r.ok || !r.clave) {
                                      toast.error(r.error ?? "No se pudo restablecer.")
                                      return
                                    }
                                    // Copiar es una comodidad; enseñar la clave
                                    // es imprescindible. Si el portapapeles
                                    // falla —permiso denegado, contexto no
                                    // seguro— y se copiara antes de avisar, la
                                    // contraseña quedaría cambiada y sin que
                                    // nadie la haya visto: esa persona se queda
                                    // fuera y solo se arregla con otro
                                    // restablecimiento.
                                    const copiada = await navigator.clipboard
                                      .writeText(r.clave)
                                      .then(() => true)
                                      .catch(() => false)
                                    toast.success(
                                      copiada
                                        ? "Contraseña nueva copiada"
                                        : "Contraseña nueva (cópiala a mano)",
                                      {
                                        description: `${profile.full_name} → ${r.clave}. No se vuelve a mostrar.`,
                                        duration: 20000,
                                      },
                                    )
                                  })
                                }
                              >
                                <KeyRound className="size-4" />
                                Restablecer contraseña
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {profile.status === "inactivo" ? (
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
                              ) : (
                                <DropdownMenuItem
                                  disabled={esYo}
                                  onSelect={() =>
                                    correr(
                                      () => setUserActive(profile.id, false),
                                      `${profile.full_name} suspendido`,
                                    )
                                  }
                                >
                                  Suspender acceso
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

      <CambiarCorreoDialog user={aCambiarCorreo} onClose={() => setACambiarCorreo(null)} />

      <EditarUsuarioDialog
        user={aEditar}
        companies={companies}
        onClose={() => setAEditar(null)}
      />

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

function NuevoUsuarioDialog({ companies }: { companies: Empresa[] }) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("asesor")
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [pendiente, startTransition] = useTransition()

  const valido = fullName.trim().length > 2 && /.+@.+\..+/.test(email)

  function limpiar() {
    setFullName("")
    setEmail("")
    setRole("asesor")
    setSeleccionadas([])
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
            Se le envía una invitación por correo. Queda activo cuando define su contraseña.
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
                {companies.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todavía no hay empresas. Puedes crear el usuario ahora y asignarlo después.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {companies.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={seleccionadas.includes(c.id)}
                          onCheckedChange={() =>
                            setSeleccionadas((prev) =>
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
                )}
                <p className="text-xs text-muted-foreground">
                  Entra en la sede principal de cada empresa. Se ajusta desde el equipo de la
                  empresa.
                </p>
              </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pendiente}
            onClick={() =>
              startTransition(async () => {
                const r = await inviteUser({
                  full_name: fullName,
                  email,
                  role,
                  company_ids: role === "super_admin" ? [] : seleccionadas,
                })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo crear el usuario.")
                  return
                }
                toast.success(`${fullName} creado`, {
                  description: "Se le envió la invitación por correo.",
                })
                limpiar()
                setOpen(false)
              })
            }
          >
            {pendiente ? "Creando…" : "Crear e invitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Edición de un usuario: sus datos y en qué empresas entra.
 *
 * El rol dentro de cada empresa se elige acá porque puede no ser el mismo en
 * todas: alguien coordina una y asesora en otra. La sede no se toca desde acá
 * —se hereda la que ya tenía, o la principal— porque quien la conoce es el
 * equipo de esa empresa, y ahí está la pantalla para moverla.
 */
function EditarUsuarioDialog({
  user,
  companies,
  onClose,
}: {
  user: UserRow | null
  companies: Empresa[]
  onClose: () => void
}) {
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [asignaciones, setAsignaciones] = useState<
    Record<string, "coordinador" | "asesor">
  >({})
  const [pendiente, startTransition] = useTransition()

  // Se resiembra el formulario cada vez que se abre con otro usuario. Se hace
  // en render y no en un efecto para no pintar un frame con los datos del
  // usuario anterior.
  const [cargado, setCargado] = useState<string | null>(null)
  if (user && cargado !== user.id) {
    setCargado(user.id)
    setFullName(user.full_name)
    setPhone(user.phone ?? "")
    setAsignaciones(
      Object.fromEntries(
        user.companies.map((c) => [
          c.company_id,
          c.role === "coordinador" ? "coordinador" : "asesor",
        ]),
      ),
    )
  }
  if (!user && cargado !== null) setCargado(null)

  const esSuperAdmin = user?.role === "super_admin"

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {user?.full_name}</DialogTitle>
          <DialogDescription>
            Datos de la cuenta y empresas a las que tiene acceso.
          </DialogDescription>
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
            <Label htmlFor="editar-telefono">Teléfono (opcional)</Label>
            <Input
              id="editar-telefono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 000 0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Empresas asignadas</Label>
            {esSuperAdmin && (
              <p className="text-xs text-muted-foreground">
                Un super admin ve todas las empresas sin necesidad de asignación. Asignarlo solo
                sirve para que aparezca como responsable en los formularios de captura.
              </p>
            )}
            {companies.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todavía no hay empresas creadas.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {companies.map((c) => {
                  const activa = c.id in asignaciones
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={`empresa-${c.id}`}
                        checked={activa}
                        onCheckedChange={() =>
                          setAsignaciones((prev) => {
                            const next = { ...prev }
                            if (activa) delete next[c.id]
                            else next[c.id] = "asesor"
                            return next
                          })
                        }
                      />
                      <Label htmlFor={`empresa-${c.id}`} className="flex-1 cursor-pointer text-sm font-normal">
                        {c.name}
                      </Label>
                      {activa && (
                        <Select
                          value={asignaciones[c.id]}
                          onValueChange={(v) =>
                            setAsignaciones((prev) => ({
                              ...prev,
                              [c.id]: v as "coordinador" | "asesor",
                            }))
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
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Quitar una empresa no borra nada: el usuario deja de verla, pero sus registros
              siguen contando en los reportes de esa empresa.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pendiente || fullName.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                if (!user) return
                const datos = await updateUserProfile(user.id, { full_name: fullName, phone })
                if (!datos.ok) {
                  toast.error(datos.error)
                  return
                }
                const empresas = await setUserCompanies(
                  user.id,
                  Object.entries(asignaciones).map(([company_id, role]) => ({
                    company_id,
                    role,
                  })),
                )
                if (!empresas.ok) {
                  toast.error(empresas.error)
                  return
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
 * Cambia el correo de una cuenta.
 *
 * Es lo que cierra el flujo de las cuentas provisionales: alguien entró con un
 * usuario terminado en `.invalid` y ahora sí mandó su correo. Cambiarlo no
 * mueve nada más —la cuenta conserva su identificador— así que su histórico,
 * sus empresas y sus metas siguen donde estaban.
 */
function CambiarCorreoDialog({
  user,
  onClose,
}: {
  user: UserRow | null
  onClose: () => void
}) {
  const [correo, setCorreo] = useState("")
  const [pendiente, startTransition] = useTransition()

  const provisional = user?.email.endsWith(".invalid") ?? false
  const valido = /.+@.+\..+/.test(correo.trim())

  return (
    <Dialog
      open={!!user}
      onOpenChange={(o) => {
        if (!o) {
          setCorreo("")
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar el correo de {user?.full_name}</DialogTitle>
          <DialogDescription>
            {provisional
              ? "Esta cuenta entró con un usuario provisional. Al poner el correo real podrá recuperar su contraseña sola."
              : "Con el correo nuevo entrará a partir de ahora."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Correo actual</Label>
            <p className="font-mono text-sm">{user?.email}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="correo-nuevo">Correo nuevo</Label>
            <Input
              id="correo-nuevo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="nombre@gmail.com"
              autoFocus
            />
          </div>
          <Alert>
            <Info />
            <AlertDescription>
              La contraseña no cambia y el histórico tampoco: la cuenta es la misma, solo cambia
              con qué correo entra.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pendiente}
            onClick={() =>
              startTransition(async () => {
                if (!user) return
                const r = await changeUserEmail(user.id, correo)
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                toast.success(`${user.full_name} ahora entra con ${correo.trim().toLowerCase()}`)
                setCorreo("")
                onClose()
              })
            }
          >
            {pendiente ? "Guardando…" : "Cambiar correo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
