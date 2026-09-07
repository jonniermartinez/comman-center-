"use client"

import { ShieldCheck } from "lucide-react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { resendCode, verifyEmailCode, type ActionState } from "@/lib/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function VerifyForm({ email, tipo }: { email: string; tipo: "signup" | "recovery" }) {
  const [state, action] = useActionState<ActionState, FormData>(verifyEmailCode, {})
  const [reenvio, reenviar] = useActionState<ActionState, FormData>(resendCode, {})

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="tipo" value={tipo} />

        <div className="space-y-2">
          <Label htmlFor="token">Código</Label>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="123456"
            className="text-center text-lg tracking-[0.5em]"
          />
        </div>

        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <SubmitButton />
      </form>

      <form action={reenviar} className="space-y-2 text-center">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="tipo" value={tipo} />
        {reenvio.error && (
          <Alert variant="destructive">
            <AlertDescription>{reenvio.error}</AlertDescription>
          </Alert>
        )}
        {reenvio.ok && (
          <Alert>
            <AlertDescription>{reenvio.ok}</AlertDescription>
          </Alert>
        )}
        <ResendButton />
      </form>
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <ShieldCheck className="size-4" />
      {pending ? "Confirmando…" : "Confirmar"}
    </Button>
  )
}

function ResendButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="link" size="sm" disabled={pending} className="text-xs">
      {pending ? "Enviando…" : "¿No llegó? Enviar otro código"}
    </Button>
  )
}
