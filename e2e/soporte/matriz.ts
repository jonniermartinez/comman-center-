import { anotar, type Modulo } from "./anotaciones"
import type { Cliente } from "./api"
import { venta } from "./datos"
import { expect } from "./fixtures"
import type { Rastro } from "./rastro"

/**
 * La matriz de capacidades, escrita una sola vez.
 *
 * Los cinco módulos de captura se comportan igual: se crea, se corrige, se
 * borra, y cada rol llega hasta donde le corresponde. Escribir esas ocho
 * pruebas cinco veces sería copiarlas cinco veces, y a la tercera copia una se
 * queda sin actualizar cuando cambie una regla.
 *
 * Aquí se define qué significa "CRUD completo" para un registro, y cada módulo
 * la invoca con lo suyo. Si mañana se añade una regla, se añade una vez y los
 * cinco módulos la prueban.
 */

interface Registro {
  /** Cómo se nombra en las pruebas: "puede crear <singular>". */
  singular: string
  modulo: Modulo
  tabla: "sales" | "payments" | "appointments" | "cash_movements" | "daily_activity"
  fila: (ctx: Contexto, extra?: Record<string, unknown>) => Record<string, unknown>
  /** ¿Necesita ir a nombre de una persona? Marca la regla "lo suyo y solo lo suyo". */
  conResponsable: boolean
  /**
   * Campos que hacen única la fila, cuando la tabla lo exige.
   *
   * Solo `daily_activity` lo necesita: una jornada por persona y día. Sin esto
   * las pruebas de este módulo chocan entre sí y el fallo parece un permiso
   * roto cuando es la regla del negocio haciendo su trabajo.
   */
  unico?: (ranura: number) => Record<string, unknown>
  /**
   * Solo lo toca quien administra, en crear, corregir y borrar.
   *
   * Es el caso de la caja, y viene de la 019: el dinero físico del punto lo
   * responde quien administra, no quien vende. Sin esta marca, las pruebas
   * darían por hecho que un asesor puede lo mismo que en los demás módulos.
   */
  soloAdmin?: boolean
  /**
   * Campo que la prueba de edición modifica.
   *
   * Cada tabla tiene el suyo: la jornada guarda las correcciones en `notas`, no
   * en `observacion`. Escribir a una columna inexistente haría fallar la prueba
   * por esquema y parecería un permiso denegado.
   */
  campoEditable: string
  /** ¿La base deja borrarlo? Desde la 024, las cinco tablas sí. */
  borrable: boolean
}

interface Contexto {
  companyId: string
  branchId: string
  staffId?: string | null
}

/**
 * Ata la fila a una venta cuando hace falta para saber de quién es.
 *
 * Un pago no lleva responsable propio: cuelga de una venta, y la política mira
 * el responsable de esa venta. Sin `sale_id`, un pago no es de nadie y ni su
 * autor puede borrarlo, que es justo lo que confundía a la prueba.
 */
async function conVenta(
  admin: Cliente,
  rastro: Rastro,
  r: Registro,
  ctx: Contexto,
): Promise<Record<string, unknown>> {
  if (r.tabla !== "payments") return {}

  // Se apunta en el rastro: si no, cada prueba de pagos dejaba una venta
  // huérfana en la base del cliente. Pasó, y se vio contando filas sobrantes.
  const { data } = await rastro.crear(admin, "sales", venta(ctx))
  return { sale_id: data!.id }
}

/** Una prueba lista para que el módulo la declare con su propio `test()`. */
/**
 * Los fixtures que puede pedir un caso.
 *
 * Se declara laxo a propósito: cada prueba desestructura los que necesita y
 * Playwright solo monta esos. Tiparlo estricto obligaría a enumerar en cada
 * caso los que no usa.
 */
export interface Caso {
  titulo: string
  ficha: ReturnType<typeof anotar>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prueba: (args: any) => Promise<void>
}

/**
 * Las capacidades de un registro, como definiciones y no como pruebas ya
 * registradas.
 *
 * Devolverlas en vez de llamar a `test()` aquí no es un capricho: Playwright
 * atribuye cada prueba al archivo donde se declara, así que si se registraran
 * en este módulo las cuarenta y cinco aparecerían amontonadas bajo
 * `matriz.ts`, y el árbol dejaría de leerse como el recorrido del software.
 * Declarándolas cada módulo, el código se comparte igual y cada prueba sale
 * donde le toca.
 */
export function capacidadesDe(r: Registro): Caso[] {
  const casos: Caso[] = []
  const test = (
    titulo: string,
    ficha: ReturnType<typeof anotar>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prueba: (args: any) => Promise<void>,
  ) => {
    casos.push({ titulo, ficha, prueba })
  }
  {
    // ------------------------------------------------------------
    // Coordinador: administra la empresa entera.
    // ------------------------------------------------------------
    test(
      `el coordinador puede crear ${r.singular}`,
      anotar({
        modulo: r.modulo,
        rol: "coordinador",
        tipo: "feature",
        porque: `Administrar la empresa incluye registrar ${r.singular} por cualquiera del equipo.`,
      }),
      async ({ apiCoordinador, apiSuperAdmin, rastro, mundo }) => {
        const ctx = { ...mundo.empresaA, staffId: mundo.staffA }

        const { data, error } = await rastro.crear(
          apiCoordinador,
          r.tabla,
          r.fila(ctx, r.unico?.(1)),
        )

        expect(
          error,
          `el coordinador no pudo crear ${r.singular}: ${error?.message}`,
        ).toBeNull()
        expect(data?.id).toBeTruthy()
      },
    )

    test(
      `el coordinador puede editar ${r.singular}`,
      anotar({
        modulo: r.modulo,
        rol: "coordinador",
        tipo: "feature",
        porque: "Corregir es tan habitual como registrar: se teclea mal y hay que arreglarlo.",
      }),
      async ({ apiCoordinador, apiSuperAdmin, rastro, mundo }) => {
        const ctx = { ...mundo.empresaA, staffId: mundo.staffA }
        const { data: creado } = await rastro.crear(
          apiSuperAdmin,
          r.tabla,
          r.fila(ctx, r.unico?.(2)),
        )
        expect(creado?.id, "el montaje no pudo crear la fila").toBeTruthy()

        const { error } = await apiCoordinador
          .from(r.tabla)
          .update({ [r.campoEditable]: "corregido por la prueba" } as never)
          .eq("id", creado!.id)

        expect(
          error,
          `el coordinador no pudo editar ${r.singular}: ${error?.message}`,
        ).toBeNull()
      },
    )

    if (r.borrable) {
      test(
        `el coordinador puede eliminar ${r.singular}`,
        anotar({
          modulo: r.modulo,
          rol: "coordinador",
          tipo: "feature",
          porque:
            "La base se lo permite (`can_manage_company`) aunque la aplicación todavía no " +
            "ofrezca el botón. Si algún día se añade, el permiso ya está donde debe.",
        }),
        async ({ apiCoordinador, apiSuperAdmin, rastro, mundo }) => {
          const ctx = { ...mundo.empresaA, staffId: mundo.staffA }
          const { data: creado, error } = await rastro.crear(
            apiSuperAdmin,
            r.tabla,
            r.fila(ctx, r.unico?.(3)),
          )

          await apiCoordinador.from(r.tabla).delete().eq("id", creado!.id)

          const { data: sigue } = await apiSuperAdmin
            .from(r.tabla)
            .select("id")
            .eq("id", creado!.id)
            .maybeSingle()
          expect(sigue, `el coordinador no pudo eliminar ${r.singular}`).toBeNull()
        },
      )
    } else {
      test(
        `nadie puede eliminar ${r.singular}, ni el super admin`,
        anotar({
          modulo: r.modulo,
          rol: ["super admin", "coordinador"],
          tipo: "integridad",
          porque:
            "`daily_activity` no tiene política de DELETE a propósito: la jornada es el " +
            "parte del día y no se borra, se corrige. Si un día aparece una política, esta " +
            "prueba avisa.",
        }),
        async ({ apiSuperAdmin, apiCoordinador, rastro, mundo }) => {
          const ctx = { ...mundo.empresaA, staffId: mundo.staffA }
          const { data: creado, error } = await rastro.crear(
            apiSuperAdmin,
            r.tabla,
            r.fila(ctx, r.unico?.(4)),
          )

          for (const cliente of [apiCoordinador, apiSuperAdmin]) {
            await cliente.from(r.tabla).delete().eq("id", creado!.id)
          }

          const { data: sigue } = await apiSuperAdmin
            .from(r.tabla)
            .select("id")
            .eq("id", creado!.id)
            .maybeSingle()
          expect(sigue, `se pudo eliminar ${r.singular}, y no debería`).toBeTruthy()

          // Limpieza por la vía que sí existe: borrar la empresa entera. Aquí
          // basta con dejarla; el desmontaje se lleva la empresa de pruebas.
        },
      )
    }

    test(
      `el coordinador no puede crear ${r.singular} en otra empresa`,
      anotar({
        modulo: r.modulo,
        rol: "coordinador",
        tipo: "seguridad",
        porque: "Administrar una empresa no da ningún permiso sobre las demás.",
      }),
      async ({ apiCoordinador, apiSuperAdmin, rastro, mundo }) => {
        const ajena = { ...mundo.empresaB, staffId: null }
        const { error } = await apiCoordinador
          .from(r.tabla)
          .insert(r.fila(ajena, r.unico?.(5)) as never)
        expect(error, `el coordinador de A creó ${r.singular} en B`).toBeTruthy()
      },
    )

    // ------------------------------------------------------------
    // Asesor: crea lo suyo, corrige lo de cualquiera, borra solo lo suyo.
    //
    // La caja queda fuera entera: ahí no puede ni crear ni corregir ni borrar.
    // ------------------------------------------------------------
    if (r.soloAdmin) {
      test(
        `el asesor no puede tocar ${r.singular}`,
        anotar({
          modulo: r.modulo,
          rol: "asesor",
          tipo: "seguridad",
          porque:
            "La caja es el dinero físico del punto y responde quien administra, no quien " +
            "vende. Es la única excepción a que el comercial maneje lo suyo.",
        }),
        async ({ apiAsesorA, apiSuperAdmin, rastro, mundo }) => {
          const ctx = { ...mundo.empresaA, staffId: mundo.staffA }

          const { error: alCrear } = await apiAsesorA.from(r.tabla).insert(r.fila(ctx) as never)
          expect(alCrear, `un asesor creó ${r.singular}`).toBeTruthy()

          const { data: creado, error } = await rastro.crear(
            apiSuperAdmin,
            r.tabla,
            r.fila(ctx),
          )
          expect(creado?.id, "el montaje no pudo crear la fila").toBeTruthy()

          await apiAsesorA
            .from(r.tabla)
            .update({ [r.campoEditable]: "no debería poder" } as never)
            .eq("id", creado!.id)
          await apiAsesorA.from(r.tabla).delete().eq("id", creado!.id)

          const { data: despues } = await apiSuperAdmin
            .from(r.tabla)
            .select("*")
            .eq("id", creado!.id)
            .maybeSingle()
          expect(despues, `un asesor eliminó ${r.singular}`).toBeTruthy()
          expect(
            (despues as unknown as Record<string, unknown>)[r.campoEditable],
            `un asesor corrigió ${r.singular}`,
          ).not.toBe("no debería poder")
        },
      )
    } else if (r.conResponsable) {
      test(
        `el asesor puede crear ${r.singular} a su nombre`,
        anotar({
          modulo: r.modulo,
          rol: "asesor",
          tipo: "feature",
          porque:
            "El comercial registra lo suyo, como en el Excel. Impedírselo obligaría a que un " +
            "coordinador transcriba lo de doce personas, que es garantizar el dato tarde y mal.",
        }),
        async ({ apiAsesorA, apiSuperAdmin, rastro, mundo }) => {
          const ctx = { ...mundo.empresaA, staffId: mundo.staffA }
          const { data, error } = await rastro.crear(
            apiAsesorA,
            r.tabla,
            r.fila(ctx, r.unico?.(6)),
          )

          expect(
            error,
            `el asesor no pudo crear su ${r.singular}: ${error?.message}`,
          ).toBeNull()
        },
      )

      test(
        `el asesor no puede crear ${r.singular} a nombre de otro`,
        anotar({
          modulo: r.modulo,
          rol: "asesor",
          tipo: "seguridad",
          porque:
            "Firmar por otro rompería las comisiones y el histórico de cada quien, que es " +
            "justo lo que el sistema existe para llevar.",
        }),
        async ({ apiAsesorA, apiSuperAdmin, rastro, mundo }) => {
          const ajeno = { ...mundo.empresaA, staffId: mundo.staffA2 }
          const { error } = await apiAsesorA
            .from(r.tabla)
            .insert(r.fila(ajeno, r.unico?.(7)) as never)
          expect(error, `un asesor registró ${r.singular} a nombre de otro`).toBeTruthy()
        },
      )
    } else {
      test(
        `el asesor no puede crear ${r.singular}`,
        anotar({
          modulo: r.modulo,
          rol: "asesor",
          tipo: "seguridad",
          porque:
            r.tabla === "cash_movements"
              ? "La caja es el dinero físico del punto y responde quien administra, no quien vende."
              : "Un pago cuelga de una venta: solo puede abonarlo quien puede tocar esa venta.",
        }),
        async ({ apiAsesorA, apiSuperAdmin, rastro, mundo }) => {
          const ctx = { ...mundo.empresaA, staffId: mundo.staffA }
          const { error } = await apiAsesorA
            .from(r.tabla)
            .insert(r.fila(ctx, r.unico?.(8)) as never)
          expect(error, `un asesor creó ${r.singular} y no debería`).toBeTruthy()
        },
      )
    }

    // Estas tres no aplican a la caja: ahí el asesor no llega a nada.
    if (!r.soloAdmin) {
      test(
        `el asesor puede corregir ${r.singular} de un compañero`,
        anotar({
          modulo: r.modulo,
          rol: "asesor",
          tipo: "feature",
          porque:
            "Quien está en el punto ve el error de un compañero que ya se fue. Si no puede " +
            "arreglarlo, el dato se queda mal hasta que aparezca un coordinador. Corregir deja " +
            "rastro y se puede volver a corregir; por eso se permite y borrar no.",
        }),
        async ({ apiAsesorA, apiSuperAdmin, rastro, mundo }) => {
          const ajeno = { ...mundo.empresaA, staffId: mundo.staffA2 }
          const { data: creado } = await rastro.crear(
            apiSuperAdmin,
            r.tabla,
            r.fila(ajeno, r.unico?.(9)),
          )
          expect(creado?.id, "el montaje no pudo crear la fila").toBeTruthy()

          const { error } = await apiAsesorA
            .from(r.tabla)
            .update({ [r.campoEditable]: "corregido por un compañero" } as never)
            .eq("id", creado!.id)
          expect(
            error,
            `el asesor no pudo corregir ${r.singular} ajena: ${error?.message}`,
          ).toBeNull()

          const { data: despues } = await apiSuperAdmin
            .from(r.tabla)
            .select("*")
            .eq("id", creado!.id)
            .single()
          expect(
            (despues as unknown as Record<string, unknown>)[r.campoEditable],
            "la corrección no se guardó",
          ).toBe("corregido por un compañero")
        },
      )

      if (r.borrable) {
        test(
          `el asesor puede eliminar ${r.singular} suya`,
          anotar({
            modulo: r.modulo,
            rol: "asesor",
            tipo: "feature",
            porque:
              "Si puede crearla y corregirla, tiene que poder quitarla cuando la metió por " +
              "error. Antes no podía, y la salida era dejarla en cero, que ensucia los informes.",
          }),
          async ({ apiAsesorA, apiSuperAdmin, rastro, mundo }) => {
            const mia = { ...mundo.empresaA, staffId: mundo.staffA }
            const atado = await conVenta(apiSuperAdmin, rastro, r, mia)
            const { data: creado, error } = await rastro.crear(
              apiSuperAdmin,
              r.tabla,
              r.fila(mia, { ...r.unico?.(10), ...atado }),
            )
            expect(creado?.id, "el montaje no pudo crear la fila").toBeTruthy()

            await apiAsesorA.from(r.tabla).delete().eq("id", creado!.id)

            const { data: sigue } = await apiSuperAdmin
              .from(r.tabla)
              .select("id")
              .eq("id", creado!.id)
              .maybeSingle()
            expect(sigue, `el asesor no pudo eliminar su propia ${r.singular}`).toBeNull()
          },
        )

        test(
          `el asesor no puede eliminar ${r.singular} de un compañero`,
          anotar({
            modulo: r.modulo,
            rol: "asesor",
            tipo: "seguridad",
            porque:
              "Corregir lo de otro deja rastro y se puede deshacer; borrarlo no deja nada que " +
              "revisar. Por eso el comercial corrige lo ajeno pero solo borra lo suyo.",
          }),
          async ({ apiAsesorA, apiSuperAdmin, rastro, mundo }) => {
            // A nombre del asesor B: si se crea a nombre de A, la prueba dice
            // "de un compañero" pero comprueba lo contrario y siempre falla.
            const ajeno = { ...mundo.empresaA, staffId: mundo.staffA2 }
            const atado = await conVenta(apiSuperAdmin, rastro, r, ajeno)
            const { data: creado, error } = await rastro.crear(
              apiSuperAdmin,
              r.tabla,
              r.fila(ajeno, { ...r.unico?.(11), ...atado }),
            )
            expect(creado?.id, "el montaje no pudo crear la fila").toBeTruthy()

            await apiAsesorA.from(r.tabla).delete().eq("id", creado!.id)

            // Lo que importa no es si el DELETE devolvió error: RLS puede
            // limitarse a no borrar ninguna fila y responder que todo fue bien.
            const { data: sigue } = await apiSuperAdmin
              .from(r.tabla)
              .select("id")
              .eq("id", creado!.id)
              .maybeSingle()
            expect(sigue, `un asesor eliminó ${r.singular} de otra persona`).toBeTruthy()
          },
        )
      }
    }

    test(
      `el asesor no puede leer ${r.singular} de otra empresa`,
      anotar({
        modulo: r.modulo,
        rol: "asesor",
        tipo: "seguridad",
        porque: "El aislamiento entre empresas es el contrato con cada cliente.",
      }),
      async ({ apiAsesorA, apiSuperAdmin, rastro, mundo }) => {
        const ajena = { ...mundo.empresaB, staffId: null }
        const { data } = await apiAsesorA
          .from(r.tabla)
          .select("id")
          .eq("company_id", ajena.companyId)
        expect(data ?? [], `el asesor de A leyó ${r.singular} de B`).toHaveLength(0)
      },
    )
  }

  return casos
}

export type { Registro }
