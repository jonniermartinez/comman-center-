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
  width,
}: {
  company: Pick<Company, "name" | "logo_url" | "accent_color">
  className?: string
  /** Alto en píxeles. Se usa para pedirle a la imagen el tamaño correcto. */
  size?: number
  /**
   * Ancho de la placa cuando hay logo. Casi todos los logos de estas empresas
   * son apaisados —el dibujo y al lado el nombre escrito—, así que en un
   * cuadrado quedan diminutos: el alto lo fija la franja de texto y sobra
   * blanco a los lados. Dándoles una caja más ancha que alta se leen.
   *
   * Sin logo no se usa: las iniciales siempre van en un cuadrado.
   */
  width?: number
}) {
  const clases = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-sm",
    className,
  )

  if (company.logo_url) {
    return (
      // Imagen de Storage, no del proyecto: <img> evita configurar un dominio
      // remoto en next.config para cada logo que suban.
      //
      // El fondo es blanco fijo, no el de la tarjeta: los archivos que mandan
      // las empresas son JPG con fondo blanco, así que en modo oscuro un fondo
      // oscuro solo dibujaría un recuadro claro descuadrado alrededor del logo.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={company.logo_url}
        alt={company.name}
        width={width ?? size}
        height={size}
        className={cn(clases, "border bg-white object-contain")}
        style={{ width: width ?? size, height: size }}
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
