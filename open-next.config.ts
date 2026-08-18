import { defineCloudflareConfig } from "@opennextjs/cloudflare"

/**
 * Adaptador de Next.js para Cloudflare Workers.
 *
 * Se usa OpenNext y no export estático porque `/e/[slug]` es una ruta dinámica:
 * las empresas se crean en tiempo de ejecución, así que sus slugs no se conocen
 * al compilar. Además deja el camino abierto para Supabase Auth, que necesita
 * middleware en el servidor para la sesión.
 *
 * Sin caché incremental configurado: hoy no hay ISR ni datos de servidor. Cuando
 * entre Supabase y haya páginas con revalidación, acá se agrega el caché con R2
 * o KV.
 */
export default {
  ...defineCloudflareConfig(),

  // Cloudflare Workers Builds ejecuta `npm run build`, que acá es
  // `opennextjs-cloudflare build`. Ese comando, a su vez, construye el Next
  // llamando por defecto a `npm run build` otra vez: recursión infinita que
  // agota el límite de 20 minutos del build. Apuntarlo a `build:next` corta
  // el ciclo.
  buildCommand: "npm run build:next",
}
