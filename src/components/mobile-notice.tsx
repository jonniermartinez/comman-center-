import { MonitorSmartphone } from "lucide-react"

/**
 * Aviso que reemplaza a la app en pantallas de celular.
 *
 * El corte es el breakpoint `sm` (640px): de ahí para arriba —tablet y
 * computador— la app se muestra completa. Por debajo no se renderiza nada de
 * la interfaz, solo este aviso, para no dejar a la vista pantallas que todavía
 * no están terminadas en ese ancho.
 *
 * Es solo CSS, sin medir el viewport en JavaScript: así no hay parpadeo entre
 * el HTML del servidor y la hidratación, y el corte lo resuelve el navegador
 * antes de pintar.
 */
export function MobileNotice() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 py-12 text-center sm:hidden">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-xl border bg-card"
      >
        <MonitorSmartphone className="size-5 text-muted-foreground" />
      </span>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">
          Versión móvil no disponible
        </h1>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">
          La aplicación está disponible en computador y tablet. Entra desde uno
          de esos dispositivos para registrar y consultar información.
        </p>
      </div>

      <p className="mx-auto max-w-xs border-t pt-4 text-xs text-muted-foreground">
        Tu sesión sigue activa: al abrirla en una pantalla más grande entras sin
        volver a iniciar sesión.
      </p>
    </div>
  )
}
