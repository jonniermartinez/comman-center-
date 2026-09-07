"use client"

import { UserPlus } from "lucide-react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { signUp, type ActionState } from "@/lib/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SignupForm() {
  const [state, action] = useActionState<ActionState, FormData>(signUp, {})

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre</Label>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          required
          autoFocus
          placeholder="Nombre y apellido"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nombre@empresa.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Repite la contraseña</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <UserPlus className="size-4" />
      {pending ? "Creando…" : "Crear cuenta"}
    </Button>
  )
}
