import Link from "next/link"

import { RecoverForm } from "./recover-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RecuperarPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Restablecer contraseña</CardTitle>
        <CardDescription>Te llega un enlace para entrar y definir una nueva.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RecoverForm />
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Volver a entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
