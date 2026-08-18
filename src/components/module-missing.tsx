import { Ban } from "lucide-react"
import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

/** El módulo existe en el sistema pero esta empresa no lo tiene habilitado. */
export function ModuleMissing({
  companySlug,
  companyName,
}: {
  companySlug: string
  companyName: string
}) {
  return (
    <Alert>
      <Ban />
      <AlertTitle>Módulo no habilitado</AlertTitle>
      <AlertDescription className="flex-col items-start gap-3">
        <span>{companyName} no tiene este módulo activo.</span>
        <Button asChild size="sm" variant="outline">
          <Link href={`/e/${companySlug}/configuracion`}>Ir a configuración</Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
