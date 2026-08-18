"use client"

import { Mail } from "lucide-react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { requestPasswordReset, type ActionState } from "@/lib/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RecoverForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestPasswordReset, {})

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.ok && (
        <Alert>
          <AlertDescription>{state.ok}</AlertDescription>
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
      <Mail className="size-4" />
      {pending ? "Enviando…" : "Enviar enlace"}
    </Button>
  )
}
