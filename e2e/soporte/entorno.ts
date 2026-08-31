import { config } from "dotenv";

config({ path: ".env.e2e" });

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta ${nombre} en .env.e2e. Ese archivo no se versiona: pídeselo a quien montó las pruebas o vuelve a generarlo con e2e/README.md.`,
    );
  }
  return valor;
}

export const BASE_URL = requerido("E2E_BASE_URL");
export const SUPABASE_URL = requerido("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_KEY = requerido("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

/**
 * Prefijo de todo lo que crean las pruebas.
 *
 * No es cosmético: es el único criterio por el que la limpieza acepta borrar
 * algo. Ver `guardarraíl.ts`.
 */
export const PREFIJO = "e2e-";

export type Rol =
  "superAdmin" | "coordinador" | "asesorA" | "asesorB" | "suspendido";

export interface Cuenta {
  rol: Rol;
  email: string;
  password: string;
  nombre: string;
}

export const CUENTAS: Record<Rol, Cuenta> = {
  superAdmin: {
    rol: "superAdmin",
    email: requerido("E2E_SUPER_ADMIN_EMAIL"),
    password: requerido("E2E_SUPER_ADMIN_PASSWORD"),
    nombre: "E2E Super Admin",
  },
  coordinador: {
    rol: "coordinador",
    email: requerido("E2E_COORDINADOR_EMAIL"),
    password: requerido("E2E_COORDINADOR_PASSWORD"),
    nombre: "E2E Coordinador",
  },
  asesorA: {
    rol: "asesorA",
    email: requerido("E2E_ASESOR_A_EMAIL"),
    password: requerido("E2E_ASESOR_A_PASSWORD"),
    nombre: "E2E Asesor A",
  },
  asesorB: {
    rol: "asesorB",
    email: requerido("E2E_ASESOR_B_EMAIL"),
    password: requerido("E2E_ASESOR_B_PASSWORD"),
    nombre: "E2E Asesor B",
  },
  suspendido: {
    rol: "suspendido",
    email: requerido("E2E_SUSPENDIDO_EMAIL"),
    password: requerido("E2E_SUSPENDIDO_PASSWORD"),
    nombre: "E2E Suspendido",
  },
};

/**
 * Las dos empresas del banco de pruebas.
 *
 * Son dos y no una a propósito: casi toda la seguridad que hay que demostrar es
 * "lo de la empresa A no se ve desde la B", y eso no se puede probar con una
 * sola. El asesor A vive en la primera, el B en la segunda.
 */
export const EMPRESA_A = `${PREFIJO}sandbox-a`;
export const EMPRESA_B = `${PREFIJO}sandbox-b`;

/** Empresas reales que las pruebas jamás deben tocar. Se comprueba en runtime. */
export const EMPRESAS_REALES = ["tramites", "ruta-segura", "lv", "ttc", "cea"];
