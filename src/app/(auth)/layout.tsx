import Image from "next/image"

import logo from "../../../public/command-center.png"
import { APP_NAME, OPERATOR_NAME } from "@/lib/branding"

/** Pantallas sin sesión: no llevan sidebar ni revelan nada del sistema. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* El logo ya trae el nombre escrito; el texto queda para lectores de pantalla. */}
        <Image src={logo} alt={APP_NAME} width={190} height={121} priority className="rounded-md bg-white" />
        <p className="sr-only">{APP_NAME}</p>
        <p className="text-xs text-muted-foreground">{OPERATOR_NAME}</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
