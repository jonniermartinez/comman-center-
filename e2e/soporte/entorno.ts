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

/**
 * El plantel de pruebas: diez cuentas fijas, una por situación que hay que
 * poder probar.
 *
 * Están creadas de una vez y se reutilizan en cada corrida, y ese es justo el
 * punto: no se acumulan. Antes las creaba cada prueba y la pantalla de usuarios
 * del cliente terminó con decenas de cuentas de mentira mezcladas con su gente.
 *
 * Ninguna recibe correo. Nacen confirmadas y con contraseña, que es lo mismo
 * que hace la aplicación al dar de alta al equipo de una empresa sin esperar
 * invitaciones. Lo que las pruebas crean y destruyen son las empresas, no las
 * personas.
 */
export type Rol =
  | "superAdmin"
  | "superAdmin2"
  | "coordinadorA"
  | "coordinadorB"
  | "asesorA1"
  | "asesorA2"
  | "asesorB1"
  | "suspendido"
  | "sinEmpresa"
  | "reserva"

export interface Cuenta {
  rol: Rol
  email: string
  password: string
  nombre: string
  /** Para qué está en el plantel. */
  para: string
}

function cuenta(rol: Rol, clave: string, nombre: string, para: string): Cuenta {
  return {
    rol,
    email: requerido(`E2E_${clave}_EMAIL`),
    password: requerido(`E2E_${clave}_PASSWORD`),
    nombre,
    para,
  }
}

export const CUENTAS: Record<Rol, Cuenta> = {
  superAdmin: cuenta(
    "superAdmin",
    "SUPER_ADMIN",
    "E2E Super Admin",
    "Administra toda la plataforma. Es la semilla: la única que no puede crear nadie desde dentro.",
  ),
  superAdmin2: cuenta(
    "superAdmin2",
    "SUPER_ADMIN_2",
    "E2E Super Admin 2",
    "El segundo super admin, para probar el relevo del rol con más poder.",
  ),
  coordinadorA: cuenta(
    "coordinadorA",
    "COORDINADOR_A",
    "E2E Coordinador A",
    "Administra la empresa A: crea, corrige y borra lo de todo su equipo.",
  ),
  coordinadorB: cuenta(
    "coordinadorB",
    "COORDINADOR_B",
    "E2E Coordinador B",
    "Administra la empresa B. Sirve para probar que administrar una no da permiso sobre otra.",
  ),
  asesorA1: cuenta(
    "asesorA1",
    "ASESOR_A1",
    "E2E Asesor A1",
    "Comercial de la empresa A: registra lo suyo.",
  ),
  asesorA2: cuenta(
    "asesorA2",
    "ASESOR_A2",
    "E2E Asesor A2",
    "Otro comercial de A. Sin él no se puede probar qué pasa con lo de un compañero.",
  ),
  asesorB1: cuenta(
    "asesorB1",
    "ASESOR_B1",
    "E2E Asesor B1",
    "Comercial de la empresa B: el aislamiento entre empresas se prueba con él.",
  ),
  suspendido: cuenta(
    "suspendido",
    "SUSPENDIDO",
    "E2E Suspendido",
    "Cuenta suspendida de verdad: perfil inactivo y login bloqueado en Auth.",
  ),
  sinEmpresa: cuenta(
    "sinEmpresa",
    "SIN_EMPRESA",
    "E2E Sin Empresa",
    "Entra pero no está en ninguna empresa: tiene que ver la pantalla de sin acceso.",
  ),
  reserva: cuenta(
    "reserva",
    "RESERVA",
    "E2E Reserva",
    "Libre, para la próxima prueba que necesite un rol más sin tocar la configuración.",
  ),
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
