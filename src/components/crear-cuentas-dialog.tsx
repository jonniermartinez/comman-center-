"use client"

import { Copy, KeyRound, Users } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createStaffAccounts, type CuentaCreada } from "@/lib/data/users-actions"

/**
 * Crea de una vez las cuentas del equipo que todavía no tiene.
 *
 * Entran con un usuario provisional y una contraseña temporal, sin esperar a
 * que cada quien mande su correo. Desde el primer día ven **su** histórico,
 * porque lo que ata los registros a una persona es su identificador, no su
 * correo: cuando llegue el correo real se cambia y no se mueve nada más.
 */
export function CrearCuentasDialog({
  companyId,
  pendientes,
}: {
  companyId: string
  /** Cuántos comerciales del equipo no tienen cuenta todavía. */
  pendientes: number
}) {
  const [open, setOpen] = useState(false)
  const [cuentas, setCuentas] = useState<CuentaCreada[] | null>(null)
  const [pendiente, startTransition] = useTransition()

  function copiarTodo() {
    if (!cuentas) return
    const texto = cuentas
      .map((c) => `${c.full_name}\n  usuario: ${c.usuario}\n  clave: ${c.clave}`)
      .join("\n\n")
    navigator.clipboard.writeText(texto)
    toast.success("Copiado", { description: "Pégalo donde vayas a repartir los accesos." })
  }

  if (pendientes === 0) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setCuentas(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="size-4" />
          Crear {pendientes} cuenta{pendientes === 1 ? "" : "s"}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear cuentas del equipo</DialogTitle>
          <DialogDescription>
            Sin esperar los correos: cada uno entra con un usuario provisional y una contraseña
            temporal.
          </DialogDescription>
        </DialogHeader>

        {cuentas ? (
          <div className="space-y-3">
            <Alert>
              <Users />
              <AlertDescription>
                {cuentas.length} cuenta(s) creadas y enlazadas con su histórico.{" "}
                <strong>Guarda esta lista ahora</strong>: las contraseñas no se vuelven a mostrar.
              </AlertDescription>
            </Alert>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comercial</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="w-32">Contraseña</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuentas.map((c) => (
                    <TableRow key={c.staff_id}>
                      <TableCell className="text-sm">{c.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.usuario}</TableCell>
                      <TableCell className="font-mono text-xs">{c.clave}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              Se van a crear <strong>{pendientes}</strong> cuenta(s), una por cada comercial del
              equipo que todavía no tiene.
            </p>
            <Alert>
              <AlertDescription className="space-y-2">
                <span className="block">
                  El usuario es provisional (termina en <code>.invalid</code>, un dominio que por
                  norma no existe, para que no choque nunca con el correo de una persona real).
                </span>
                <span className="block">
                  Cuando llegue el correo de verdad se cambia desde Usuarios y no se pierde nada:
                  la cuenta conserva su identificador, sus empresas y todo su histórico.
                </span>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {cuentas ? (
            <>
              <Button variant="outline" onClick={copiarTodo}>
                <Copy className="size-4" />
                Copiar la lista
              </Button>
              <Button onClick={() => setOpen(false)}>Listo</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={pendiente}
                onClick={() =>
                  startTransition(async () => {
                    const r = await createStaffAccounts(companyId)
                    if (!r.ok) {
                      toast.error(r.error ?? "No se pudieron crear las cuentas.")
                      return
                    }
                    setCuentas(r.cuentas ?? [])
                    toast.success(`${r.cuentas?.length ?? 0} cuenta(s) creadas`)
                  })
                }
              >
                {pendiente ? "Creando…" : `Crear ${pendientes} cuenta(s)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
