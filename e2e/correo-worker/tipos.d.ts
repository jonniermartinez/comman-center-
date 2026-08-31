/**
 * Lo justo del runtime de Cloudflare que usa este worker.
 *
 * Se declara a mano en vez de traer `@cloudflare/workers-types` porque esa
 * dependencia acabaría instalándose en cada build de la aplicación —que no la
 * necesita— solo para dos nombres.
 */
declare interface KVNamespace {
  get(clave: string): Promise<string | null>
  put(clave: string, valor: string, opciones?: { expirationTtl?: number }): Promise<void>
  delete(clave: string): Promise<void>
}

declare interface ForwardableEmailMessage {
  readonly from: string
  readonly to: string
  readonly raw: ReadableStream
  setReject(motivo: string): void
}
