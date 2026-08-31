import { config } from "dotenv"

config({ path: ".env.e2e" })

function requerido(nombre: string): string {
  const valor = process.env[nombre]
  if (!valor) {
    throw new Error(
      `Falta ${nombre} en .env.e2e. Ese archivo no se versiona: pídeselo a quien montó las pruebas o vuelve a generarlo con e2e/README.md.`,
    )
  }
  return valor
}

export const BASE_URL = requerido("E2E_BASE_URL")
export const SUPABASE_URL = requerido("NEXT_PUBLIC_SUPABASE_URL")
export const SUPABASE_KEY = requerido("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")

/**
 * Prefijo de todo lo que crean las pruebas.
 *
 * No es cosmético: es el único criterio por el que la limpieza acepta borrar
 * algo. Ver `guardarraíl.ts`.
 */
export const PREFIJO = "e2e-"

export type Rol = "superAdmin"

export interface Cuenta {
  rol: Rol
  email: string
  password: string
  nombre: string
}

/**
 * La única cuenta que preexiste.
 *
 * Todo lo demás —coordinadores, asesores, la cuenta suspendida— lo crean las
 * pruebas llamando a las mismas funciones que la aplicación, y lo purgan al
 * terminar. Sembrar cuentas a mano dejaba usuarios de prueba acumulándose para
 * siempre en la pantalla de usuarios del cliente.
 *
 * Esta no se puede crear desde dentro: es el equivalente al primer usuario de
 * la instalación, el que no puede dar de alta nadie porque no habría quién.
 */
export const CUENTAS: Record<Rol, Cuenta> = {
  superAdmin: {
    rol: "superAdmin",
    email: requerido("E2E_SUPER_ADMIN_EMAIL"),
    password: requerido("E2E_SUPER_ADMIN_PASSWORD"),
    nombre: "E2E Super Admin",
  },
}

/**
 * Las dos empresas del banco de pruebas.
 *
 * Son dos y no una a propósito: casi toda la seguridad que hay que demostrar es
 * "lo de la empresa A no se ve desde la B", y eso no se puede probar con una
 * sola. El asesor A vive en la primera, el B en la segunda.
 */
/**
 * Ya no hay empresas fijas: cada proceso crea las suyas (ver el fixture
 * `mundo`). Se dejan los nombres antiguos por si quedara alguna suelta de una
 * corrida vieja, para que la limpieza sepa reconocerla.
 */
export const EMPRESA_A = `${PREFIJO}sandbox-a`
export const EMPRESA_B = `${PREFIJO}sandbox-b`

/** Empresas reales que las pruebas jamás deben tocar. Se comprueba en runtime. */
export const EMPRESAS_REALES = ["tramites", "ruta-segura", "lv", "ttc", "cea"]
