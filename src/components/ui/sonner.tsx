"use client"

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Avisos emergentes.
 *
 * El tema va fijo en claro: la aplicación no tiene modo oscuro. Los colores del
 * texto se declaran acá y no se dejan a los valores por defecto de sonner,
 * porque su descripción viene con una opacidad tan baja que sobre fondo blanco
 * apenas se lee.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-600" />,
        info: <InfoIcon className="size-4 text-foreground" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-600" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "items-start gap-3 border shadow-lg",
          title: "text-sm font-medium text-foreground",
          // La opacidad va explícita: sonner la baja por su cuenta y sobre blanco
          // la descripción queda casi ilegible.
          description: "!text-sm !text-muted-foreground !opacity-100",
          icon: "mt-0.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
