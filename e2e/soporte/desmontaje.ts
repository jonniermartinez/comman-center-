import { clienteDe, limpiarTodo } from "./api"

/**
 * Se lleva todo lo que crearon las pruebas.
 *
 * Sin esto, cada corrida deja empresas de mentira en la pantalla de inicio del
 * cliente. Solo borra lo que lleva el prefijo: ver `guardarrail.ts`.
 *
 * Se puede saltar con E2E_SIN_LIMPIEZA=1 cuando se está depurando una prueba y
 * hace falta mirar qué quedó en la base.
 */
export default async function desmontaje() {
  if (process.env.E2E_SIN_LIMPIEZA === "1") {
    console.log("E2E_SIN_LIMPIEZA=1: se deja el banco de pruebas en pie.")
    return
  }

  const admin = await clienteDe("superAdmin")
  await limpiarTodo(admin)
}
