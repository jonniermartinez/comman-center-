/**
 * Enlace de WhatsApp para un número colombiano escrito como se escriba.
 *
 * En la base los celulares están como los digitó cada quien: "3001234567",
 * "300 123 4567", "+57 300 1234567". wa.me los quiere pegados y con indicativo,
 * así que acá se normaliza en vez de pedirle a nadie que los reescriba.
 *
 * Devuelve null si lo que hay no puede ser un celular: es preferible un botón
 * apagado a uno que abre WhatsApp en un número inventado.
 */
export function enlaceWhatsApp(numero?: string | null, mensaje?: string): string | null {
  const digitos = (numero ?? "").replace(/\D/g, "")
  if (!digitos) return null

  // 10 dígitos es un celular colombiano sin indicativo; con 57 delante ya son
  // 12. Cualquier otra cosa —un fijo, media línea, un documento pegado por
  // error— no se enlaza.
  const internacional =
    digitos.length === 10 ? `57${digitos}` : digitos.length === 12 && digitos.startsWith("57") ? digitos : null

  if (!internacional) return null

  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""
  return `https://wa.me/${internacional}${texto}`
}
