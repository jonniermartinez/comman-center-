"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Campo de dinero con separador de miles.
 *
 * En pesos las cifras traen muchos ceros y `18000000` es ilegible de un vistazo:
 * acá se ve `18.000.000` mientras se escribe. Se usa `type="text"` a propósito
 * —un `type="number"` rechaza los puntos— con `inputMode="numeric"` para que el
 * celular siga abriendo el teclado numérico.
 *
 * El valor que sale al padre siempre es un número; el formato es solo de
 * presentación.
 */
export function MoneyInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number
  onValueChange: (value: number) => void
}) {
  // Mientras el campo tiene el foco manda lo que escribió el usuario; al salir
  // se vuelve a formatear desde el número. Si no, borrar el último dígito
  // reformatearía a media escritura y el cursor saltaría.
  const [borrador, setBorrador] = useState<string | null>(null)

  const mostrado = borrador ?? (value ? value.toLocaleString("es-CO") : "")

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={mostrado}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D/g, "")
        const numero = digitos ? Number(digitos) : 0
        setBorrador(digitos ? numero.toLocaleString("es-CO") : "")
        onValueChange(numero)
      }}
      onBlur={(e) => {
        setBorrador(null)
        props.onBlur?.(e)
      }}
      className={cn("text-right tabular-nums", className)}
      {...props}
    />
  )
}
