import type { Cliente } from "./api"

/**
 * Lo que una prueba ha creado, para llevárselo cuando termine.
 *
 * Limpiar en la última línea de la prueba no basta: si la prueba falla antes
 * —y fallar es lo que hacen las pruebas— esa línea nunca se ejecuta y la fila
 * se queda en la base para siempre. Corriendo contra producción eso significa
 * basura acumulándose en los datos del cliente cada vez que algo va mal, que es
 * justo cuando menos atención se le presta.
 *
 * El rastro se vacía desde el desmontaje del fixture, que Playwright ejecuta
 * pase lo que pase: falle la prueba, salte una excepción o se agote el tiempo.
 */

export type Tabla =
  | "sales"
  | "payments"
  | "appointments"
  | "cash_movements"
  | "daily_activity"
  | "objectives"
  | "branches"
  | "staff"
  | "company_staff"
  | "company_users"

/**
 * Orden de borrado.
 *
 * Los pagos apuntan a las ventas, así que se van primero o la llave foránea lo
 * impide. Número más bajo, antes.
 */
const ORDEN: Record<string, number> = {
  payments: 0,
  sales: 1,
  appointments: 1,
  cash_movements: 1,
  daily_activity: 1,
  objectives: 1,
  company_users: 2,
  company_staff: 2,
  branches: 3,
  staff: 4,
}

export interface Rastro {
  /** Apunta una fila ya creada para que se borre al final. */
  anotar(tabla: Tabla, id: string | null | undefined): void
  /**
   * Apunta una cuenta para borrarla al final.
   *
   * Se purga de verdad, no se marca. La baja lógica es lo correcto para una
   * persona real —el histórico tiene que seguir diciendo quién hizo cada
   * cosa— pero para las cuentas que inventan las pruebas es lo contrario: si
   * solo se marcan, se acumulan para siempre en la pantalla de usuarios del
   * cliente. `purge_test_user` solo acepta correos del patrón de pruebas.
   */
  anotarUsuario(id: string | null | undefined): void
  /**
   * Crea una fila y la apunta de una vez.
   *
   * Devuelve lo mismo que Supabase —`{ data, error }`— para que la prueba pueda
   * seguir comprobando el error cuando lo que prueba es justo que falle.
   */
  crear(
    cliente: Cliente,
    tabla: Tabla,
    fila: Record<string, unknown>,
  ): Promise<{ data: { id: string } | null; error: { message: string } | null }>
}

export function nuevoRastro(): { rastro: Rastro; limpiar: (admin: Cliente) => Promise<void> } {
  const filas: { tabla: Tabla; id: string }[] = []
  const usuarios: string[] = []

  const rastro: Rastro = {
    anotar(tabla, id) {
      if (id) filas.push({ tabla, id })
    },
    anotarUsuario(id) {
      if (id) usuarios.push(id)
    },
    async crear(cliente, tabla, fila) {
      const { data, error } = await cliente
        .from(tabla)
        .insert(fila as never)
        .select("id")
        .single()
      // Se apunta aunque la prueba vaya a fallar después: lo que importa es que
      // la fila existe en la base, no que la prueba esté contenta.
      if (data && "id" in data) rastro.anotar(tabla, (data as { id: string }).id)
      return {
        data: (data as { id: string } | null) ?? null,
        error: error ? { message: error.message } : null,
      }
    },
  }

  async function limpiar(admin: Cliente) {
    const pendientes = [...filas].sort((a, b) => ORDEN[a.tabla] - ORDEN[b.tabla])
    for (const { tabla, id } of pendientes) {
      // El `as never` es por el tipado generado de Supabase: `tabla` es una
      // unión y ahí `eq("id", …)` no resuelve a una columna concreta.
      const { error } = await admin
        .from(tabla)
        .delete()
        .eq("id" as never, id as never)
      // No se lanza: una limpieza a medias no puede convertir una prueba en
      // verde en una en rojo. Pero sí se avisa, porque significa basura viva en
      // la base del cliente.
      if (error) console.error(`rastro: quedó sin borrar ${tabla}/${id}: ${error.message}`)
    }
    filas.length = 0

    for (const id of usuarios) {
      const { error } = await admin.rpc("purge_test_user", { target_user: id })
      if (error) console.error(`rastro: quedó sin borrar el usuario ${id}: ${error.message}`)
    }
    usuarios.length = 0
  }

  return { rastro, limpiar }
}
