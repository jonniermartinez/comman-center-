"use client"

import { cn } from "@/lib/utils"
import type { Company } from "@/lib/store/types"

/**
 * Marca de la empresa: su logo si lo subieron, y si no, sus iniciales sobre el
 * color de acento.
 *
 * Las iniciales no son un hueco a la espera del logo: para una empresa pequeña
 * que no tiene archivo a mano, son la identidad definitiva, y por eso llevan su
 * color y no un gris de relleno.
 */
export function CompanyAvatar({
  company,
  className,
  size = 40,
}: {
  company: Pick<Company, "name" | "logo_url" | "accent_color">
  className?: string
  /** Lado en píxeles. Se usa para pedirle a la imagen el tamaño correcto. */
  size?: number
}) {
  const clases = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-sm",
    className,
  )

  if (company.logo_url) {
    return (
      // Imagen de Storage, no del proyecto: <img> evita configurar un dominio
      // remoto en next.config para cada logo que suban.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={company.logo_url}
        alt={company.name}
        width={size}
        height={size}
        className={cn(clases, "border bg-card object-contain")}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(clases, "font-bold text-white")}
      style={{
        backgroundColor: company.accent_color,
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
      }}
    >
      {company.name.slice(0, 2).toUpperCase()}
    </span>
  )
}
