import { anotar } from "../soporte/anotaciones"
import { empresaPorSlug, type Cliente } from "../soporte/api"
import { mesDe, hoyISO } from "../soporte/datos"
import { EMPRESA_A, EMPRESA_B } from "../soporte/entorno"
import { expect, test } from "../soporte/fixtures"

/**
 * Las metas del mes, que es donde el software dice cuánto dinero hay que hacer.
 *
 * Se prueban con más cuidado que otras pantallas por dos motivos. El primero es
 * que hoy no hay ni una meta cargada en producción: la tabla está a cero, así
 * que nadie ha ejercido nunca este código con datos. El segundo es que las
 * metas en moneda manejan cifras de cientos de millones —la facturación real de
 * agosto ronda los $133 M en una sola empresa— y ahí un redondeo o un tipo
 * numérico corto no se nota hasta que la cifra sale mal en el informe del mes.
 */

/** Las siete métricas del sistema, con la unidad que declara cada una. */
const METRICAS = {
  cantidad: "ventas_mensuales",
  moneda: "facturacion",
  porcentaje: "ratio_contactabilidad",
} as const

/**
 * Un mes distinto por prueba.
 *
 * Las metas se identifican por (empresa, mes, métrica), así que si todas usaran
 * el mes actual se borrarían las unas a las otras al limpiar y fallarían por
 * pisarse, no por lo que dicen probar. Meses pasados: no hay nada que impida
 * consultar el histórico de metas.
 */
function mesAtras(n: number): string {
  const fecha = new Date()
  fecha.setDate(1)
  fecha.setMonth(fecha.getMonth() - n)
  return mesDe(fecha.toISOString().slice(0, 10))
}

async function empresaId(admin: Cliente, slug: string) {
  const empresa = await empresaPorSlug(admin, slug)
  if (!empresa) throw new Error(`El montaje no dejó la empresa ${slug}`)
  return empresa.id
}

async function limpiarMetas(admin: Cliente, companyId: string, mes: string) {
  await admin.from("objectives").delete().eq("company_id", companyId).eq("period_month", mes)
}

test.describe("Objetivos", () => {
  test(
    "el coordinador puede fijar una meta de facturación en pesos",
    anotar({
      modulo: "Objetivos",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "Es la meta que de verdad importa: cuánto dinero tiene que facturar la empresa este " +
        "mes. Sin ella, la pantalla de objetivos no dice nada.",
    }),
    async ({ apiCoordinador, apiSuperAdmin }) => {
      const MES = mesAtras(1)
      const id = await empresaId(apiSuperAdmin, EMPRESA_A)
      await limpiarMetas(apiSuperAdmin, id, MES)

      // 150 millones: el orden de magnitud real de una empresa mediana aquí.
      const META = 150_000_000

      const { error } = await apiCoordinador.from("objectives").insert({
        company_id: id,
        period_month: MES,
        metric_code: METRICAS.moneda,
        target_value: META,
      } as never)
      expect(error, `no se pudo fijar la meta: ${error?.message}`).toBeNull()

      const { data } = await apiSuperAdmin
        .from("objectives")
        .select("target_value, metric_code")
        .eq("company_id", id)
        .eq("period_month", MES)
        .eq("metric_code", METRICAS.moneda)
        .single()

      expect(
        Number(data!.target_value),
        "la meta en pesos no se guardó con su valor exacto",
      ).toBe(META)

      await limpiarMetas(apiSuperAdmin, id, MES)
    },
  )

  test(
    "una meta de miles de millones no pierde precisión",
    anotar({
      modulo: "Objetivos",
      rol: "coordinador",
      tipo: "integridad",
      porque:
        "Los pesos colombianos hacen cifras largas: una meta anual de facturación se va a " +
        "los miles de millones. Si la columna fuese un entero de 32 bits o un float, el " +
        "número se truncaría o se redondearía y la meta quedaría mal sin avisar a nadie.",
    }),
    async ({ apiCoordinador, apiSuperAdmin }) => {
      const MES = mesAtras(2)
      const id = await empresaId(apiSuperAdmin, EMPRESA_A)
      await limpiarMetas(apiSuperAdmin, id, MES)

      // Fuera del rango de un int de 32 bits (2.147.483.647) a propósito.
      const META = 9_876_543_210

      const { error } = await apiCoordinador.from("objectives").insert({
        company_id: id,
        period_month: MES,
        metric_code: METRICAS.moneda,
        target_value: META,
      } as never)
      expect(error, `la base rechazó una cifra grande: ${error?.message}`).toBeNull()

      const { data } = await apiSuperAdmin
        .from("objectives")
        .select("target_value")
        .eq("company_id", id)
        .eq("period_month", MES)
        .eq("metric_code", METRICAS.moneda)
        .single()

      expect(Number(data!.target_value), "la cifra se truncó o se redondeó al guardarla").toBe(
        META,
      )

      await limpiarMetas(apiSuperAdmin, id, MES)
    },
  )

  test(
    "una meta con centavos se guarda con sus decimales",
    anotar({
      modulo: "Objetivos",
      rol: "coordinador",
      tipo: "integridad",
      porque:
        "Aunque en pesos no suelan usarse centavos, si la columna admite decimales tienen " +
        "que sobrevivir: una meta que se guarda redondeada descuadra el cumplimiento.",
    }),
    async ({ apiCoordinador, apiSuperAdmin }) => {
      const MES = mesAtras(3)
      const id = await empresaId(apiSuperAdmin, EMPRESA_A)
      await limpiarMetas(apiSuperAdmin, id, MES)

      const META = 1_234_567.89

      await apiCoordinador.from("objectives").insert({
        company_id: id,
        period_month: MES,
        metric_code: METRICAS.moneda,
        target_value: META,
      } as never)

      const { data } = await apiSuperAdmin
        .from("objectives")
        .select("target_value")
        .eq("company_id", id)
        .eq("period_month", MES)
        .eq("metric_code", METRICAS.moneda)
        .single()

      expect(Number(data!.target_value), "los decimales se perdieron").toBeCloseTo(META, 2)

      await limpiarMetas(apiSuperAdmin, id, MES)
    },
  )

  test(
    "el coordinador puede fijar metas de cantidad y de porcentaje",
    anotar({
      modulo: "Objetivos",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "Las siete métricas del sistema vienen en tres unidades —cantidad, moneda y " +
        "porcentaje— y cada una se muestra distinta. Si solo se probara la de dinero, un " +
        "fallo en las otras dos pasaría desapercibido.",
    }),
    async ({ apiCoordinador, apiSuperAdmin }) => {
      const MES = mesAtras(4)
      const id = await empresaId(apiSuperAdmin, EMPRESA_A)
      await limpiarMetas(apiSuperAdmin, id, MES)

      const metas = [
        { metric_code: METRICAS.cantidad, target_value: 120 },
        { metric_code: METRICAS.porcentaje, target_value: 65 },
      ]

      for (const meta of metas) {
        const { error } = await apiCoordinador
          .from("objectives")
          .insert({ company_id: id, period_month: MES, ...meta } as never)
        expect(error, `no se pudo fijar ${meta.metric_code}: ${error?.message}`).toBeNull()
      }

      const { data } = await apiSuperAdmin
        .from("objectives")
        .select("metric_code, target_value")
        .eq("company_id", id)
        .eq("period_month", MES)

      expect(data ?? []).toHaveLength(2)
      await limpiarMetas(apiSuperAdmin, id, MES)
    },
  )

  test(
    "el coordinador puede cambiar una meta ya fijada",
    anotar({
      modulo: "Objetivos",
      rol: "coordinador",
      tipo: "feature",
      porque: "Las metas se ajustan a mitad de mes; fijarlas una sola vez no serviría.",
    }),
    async ({ apiCoordinador, apiSuperAdmin }) => {
      const MES = mesAtras(5)
      const id = await empresaId(apiSuperAdmin, EMPRESA_A)
      await limpiarMetas(apiSuperAdmin, id, MES)

      await apiSuperAdmin.from("objectives").insert({
        company_id: id,
        period_month: MES,
        metric_code: METRICAS.moneda,
        target_value: 100_000_000,
      } as never)

      const { error } = await apiCoordinador
        .from("objectives")
        .update({ target_value: 175_000_000 })
        .eq("company_id", id)
        .eq("period_month", MES)
        .eq("metric_code", METRICAS.moneda)
      expect(error, `no se pudo ajustar la meta: ${error?.message}`).toBeNull()

      const { data } = await apiSuperAdmin
        .from("objectives")
        .select("target_value")
        .eq("company_id", id)
        .eq("period_month", MES)
        .eq("metric_code", METRICAS.moneda)
        .single()
      expect(Number(data!.target_value)).toBe(175_000_000)

      await limpiarMetas(apiSuperAdmin, id, MES)
    },
  )

  test(
    "el asesor no puede fijar metas",
    anotar({
      modulo: "Objetivos",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "Poner su propia meta es poner su propia comisión. Las metas las fija quien " +
        "administra la empresa.",
    }),
    async ({ apiAsesorA, apiSuperAdmin }) => {
      const MES = mesAtras(6)
      const id = await empresaId(apiSuperAdmin, EMPRESA_A)

      const { error } = await apiAsesorA.from("objectives").insert({
        company_id: id,
        period_month: MES,
        metric_code: METRICAS.moneda,
        target_value: 1,
      } as never)
      expect(error, "un asesor se fijó su propia meta").toBeTruthy()
    },
  )

  test(
    "el asesor no puede cambiar una meta ya fijada",
    anotar({
      modulo: "Objetivos",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "Bajarse la meta es el atajo más obvio para cumplirla. Se comprueba el valor después " +
        "del UPDATE, no si dio error: una política mal escrita puede aceptar y no aplicar.",
    }),
    async ({ apiAsesorA, apiSuperAdmin }) => {
      const MES = mesAtras(7)
      const id = await empresaId(apiSuperAdmin, EMPRESA_A)
      await limpiarMetas(apiSuperAdmin, id, MES)

      await apiSuperAdmin.from("objectives").insert({
        company_id: id,
        period_month: MES,
        metric_code: METRICAS.moneda,
        target_value: 200_000_000,
      } as never)

      await apiAsesorA
        .from("objectives")
        .update({ target_value: 1 })
        .eq("company_id", id)
        .eq("period_month", MES)
        .eq("metric_code", METRICAS.moneda)

      const { data } = await apiSuperAdmin
        .from("objectives")
        .select("target_value")
        .eq("company_id", id)
        .eq("period_month", MES)
        .eq("metric_code", METRICAS.moneda)
        .single()

      expect(Number(data!.target_value), "un asesor se rebajó la meta").toBe(200_000_000)
      await limpiarMetas(apiSuperAdmin, id, MES)
    },
  )

  test(
    "el coordinador no puede fijar metas en otra empresa",
    anotar({
      modulo: "Objetivos",
      rol: "coordinador",
      tipo: "seguridad",
      porque: "Administrar una empresa no da permiso sobre las metas de las demás.",
    }),
    async ({ apiCoordinador, apiSuperAdmin }) => {
      const MES = mesAtras(7)
      const ajena = await empresaId(apiSuperAdmin, EMPRESA_B)

      const { error } = await apiCoordinador.from("objectives").insert({
        company_id: ajena,
        period_month: MES,
        metric_code: METRICAS.moneda,
        target_value: 1,
      } as never)
      expect(error, "el coordinador de A fijó una meta en B").toBeTruthy()
    },
  )

  test(
    "el asesor no puede leer las metas de otra empresa",
    anotar({
      modulo: "Objetivos",
      rol: "asesor",
      tipo: "seguridad",
      porque: "Las metas dicen cuánto factura un cliente: es información suya, de nadie más.",
    }),
    async ({ apiAsesorA, apiSuperAdmin }) => {
      const MES = mesAtras(8)
      const ajena = await empresaId(apiSuperAdmin, EMPRESA_B)
      await apiSuperAdmin.from("objectives").insert({
        company_id: ajena,
        period_month: MES,
        metric_code: METRICAS.moneda,
        target_value: 999_000_000,
      } as never)

      const { data } = await apiAsesorA
        .from("objectives")
        .select("target_value")
        .eq("company_id", ajena)
        .eq("period_month", MES)
      expect(data ?? [], "el asesor de A leyó las metas de B").toHaveLength(0)

      await limpiarMetas(apiSuperAdmin, ajena, MES)
    },
  )
})
