import { APP_NAME, OPERATOR_NAME } from "@/lib/branding"

/** Pantallas sin sesión: no llevan sidebar ni revelan nada del sistema. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <p className="text-base font-semibold tracking-tight">{APP_NAME}</p>
        <p className="text-xs text-muted-foreground">{OPERATOR_NAME}</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
