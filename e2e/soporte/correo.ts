import { config } from "dotenv"

config({ path: ".env.e2e" })

/**
 * Lee los correos que Supabase manda a las direcciones de prueba.
 *
 * Detrás hay un Email Worker (`e2e/correo-worker/`) porque Email Routing de
 * Cloudflare solo reenvía: no guarda nada ni tiene API de lectura.
 */

const URL_BUZON = process.env.E2E_MAIL_URL
const SECRETO = process.env.E2E_MAIL_SECRET

/** Direcciones que el worker acepta. Fuera de este patrón el correo se rechaza. */
export const BUZON_INVITADO = "e2e-cc-invitado@jonnier.com"
export const BUZON_RECUPERA = "e2e-cc-recupera@jonnier.com"

export interface Correo {
  asunto: string
  de: string
  recibidoEn: string
  texto: string
  enlaces: string[]
  tokenHash: string | null
  tipo: string | null
}

export function hayBuzon(): boolean {
  return Boolean(URL_BUZON && SECRETO)
}

async function pedir(metodo: string, email: string) {
  if (!hayBuzon()) {
    throw new Error("Faltan E2E_MAIL_URL / E2E_MAIL_SECRET en .env.e2e")
  }
  const respuesta = await fetch(`${URL_BUZON}/correos?email=${encodeURIComponent(email)}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${SECRETO}` },
  })
  if (!respuesta.ok) {
    throw new Error(`Buzón ${email}: ${respuesta.status} ${await respuesta.text()}`)
  }
  return respuesta.json()
}

/**
 * Vacía el buzón.
 *
 * Obligatorio antes de disparar un correo: si no, se lee el de la corrida
 * anterior y la prueba pasa sin haber probado el envío de esta.
 */
export async function vaciarBuzon(email: string): Promise<void> {
  await pedir("DELETE", email)
}

/**
 * ¿Puede Supabase mandar correos ahora mismo?
 *
 * El remitente por defecto va limitado a unos pocos por hora y responde 429
 * `over_email_send_rate_limit`. Cuando eso pasa, esperar dos minutos a un
 * correo que nunca se envió no aporta nada: es mejor decirlo de inmediato y
 * con el motivo, que además es el mismo que impide invitar a una persona real.
 */
export async function limiteDeCorreoAlcanzado(email: string): Promise<boolean> {
  const respuesta = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  })
  return respuesta.status === 429
}

/**
 * Espera a que llegue un correo.
 *
 * El plazo es generoso porque el envío no es instantáneo: pasa por el SMTP de
 * Supabase y por Email Routing, y medido en producción el primero puede tardar
 * más de un minuto.
 */
export async function esperarCorreo(
  email: string,
  opciones: { asunto?: RegExp; timeoutMs?: number } = {},
): Promise<Correo> {
  const limite = Date.now() + (opciones.timeoutMs ?? 120_000)
  let vistos = 0

  while (Date.now() < limite) {
    const { correos } = (await pedir("GET", email)) as { correos: Correo[] }
    vistos = correos.length
    const encontrado = opciones.asunto
      ? correos.find((c) => opciones.asunto!.test(c.asunto))
      : correos[0]
    if (encontrado) return encontrado
    await new Promise((r) => setTimeout(r, 3000))
  }

  throw new Error(
    `No llegó correo a ${email} en ${(opciones.timeoutMs ?? 120_000) / 1000}s ` +
      `(${vistos} correos en el buzón${opciones.asunto ? `, ninguno con asunto ${opciones.asunto}` : ""}). ` +
      `Si el buzón está vacío, casi seguro es el límite de envío: el remitente por ` +
      `defecto de Supabase responde 429 over_email_send_rate_limit tras unos pocos ` +
      `correos por hora. Hace falta SMTP propio (Resend, SES) — y no solo para las ` +
      `pruebas: con ese límite tampoco se puede invitar a varias personas seguidas.`,
  )
}

/**
 * La ruta de la aplicación que canjea el token del correo.
 *
 * Se construye a mano en vez de seguir el enlace tal cual porque la plantilla
 * por defecto de Supabase apunta a su propio `/auth/v1/verify`, que al terminar
 * redirige a la Site URL del proyecto. La aplicación espera el token en
 * `/auth/confirm`, así que se le entrega ahí directamente. Ver `docs/SUPABASE.md`.
 */
export function rutaDeConfirmacion(correo: Correo, siguiente: string): string {
  if (!correo.tokenHash) {
    throw new Error(`El correo "${correo.asunto}" no traía token: ${correo.enlaces.join(" ")}`)
  }
  const tipo = correo.tipo ?? "magiclink"
  return `/auth/confirm?token_hash=${correo.tokenHash}&type=${tipo}&next=${encodeURIComponent(siguiente)}`
}
