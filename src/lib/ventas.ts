/**
 * Una venta es de contado cuando se financió como "contado". Sin financiación
 * registrada se asume crédito: es el caso normal en esta cartera, y pedir
 * comprobante de más cuesta menos que dejar un abono a crédito sin respaldo.
 */
export function esVentaDeContado(financingCode: string | null | undefined): boolean {
  return financingCode === "contado"
}
