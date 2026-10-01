import {
  Barra,
  Cifras,
  Informe,
  Pildora,
  Seccion,
  Tabla,
  type Columna,
} from "@/components/informes/informe"
import { formatCOP, formatCOPShort, formatNumber, formatPercent } from "@/lib/format"
import {
  cumplimientoDelMes,
  diasCorridos,
  facturacionTotal,
  leerKpi,
  promediosDe,
  rentabilidadPauta,
  repartoPorCanal,
  type FilaIndicadores,
  type Kpi,
} from "@/lib/indicadores"

const pesos = (n: number | null) => (n === null ? "—" : formatCOPShort(n))
const veces = (n: number | null) =>
  n === null ? "—" : `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })}×`
const uno = (n: number | null) => (n === null ? "—" : formatNumber(Math.round(n * 10) / 10))

type Campo = [keyof FilaIndicadores, string, boolean?]

/**
 * La hoja de gestión, partida en los mismos bloques del formulario de la
 * jornada. En pantalla es una sola tabla de 36 columnas con desplazamiento
 * lateral; en una hoja eso no se puede leer, así que cada bloque es su tabla.
 */
const BLOQUES: { titulo: string; campos: Campo[] }[] = [
  {
    titulo: "Llamadas",
    campos: [
      ["dias_laborados", "Días"],
      ["dias_tarde", "Tarde"],
      ["llamada_efectiva", "Efectiva"],
      ["llamada_seguimiento", "Seguim."],
      ["llamada_agenda", "Agenda"],
      ["llamada_no_interesado", "No interes."],
      ["llamada_postventa", "Postventa"],
      ["llamadas_contestadas", "Contestadas", true],
      ["llamada_no_contestada", "No contest."],
      ["total_llamadas", "Total", true],
    ],
  },
  {
    titulo: "Agendas",
    campos: [
      ["agenda_confirmada", "Confirmada"],
      ["agenda_posible", "Posible"],
      ["agenda_reprograma", "Reprograma"],
      ["agenda_no_contesta", "No contesta"],
      ["agenda_cancela", "Cancela"],
      ["total_agendas", "Total", true],
      ["atencion_agenda", "Atendidas"],
    ],
  },
  {
    titulo: "Atención presencial y administrativa",
    campos: [
      ["atencion_venta", "Venta"],
      ["atencion_venta_externa", "Externa"],
      ["atencion_seguimiento", "Seguim."],
      ["atencion_declinado", "Declinado"],
      ["total_atencion", "Total", true],
      ["atencion_asociado", "Asociado"],
      ["atencion_enrolamiento", "Enrol."],
      ["atencion_certificados", "Certif."],
      ["atencion_renovacion", "Renov."],
      ["total_administrativa", "Total adm.", true],
    ],
  },
  {
    titulo: "Cola del CRM",
    campos: [
      ["chats_inicial", "Chats inicial"],
      ["chats_medio", "Chats medio día"],
      ["chats_final", "Chats final"],
      ["tareas_inicial", "Tareas inicial"],
      ["tareas_medio", "Tareas medio día"],
      ["tareas_final", "Tareas final"],
      ["caducadas_inicial", "Caducadas inicial"],
      ["caducadas_medio", "Caducadas medio día"],
      ["caducadas_final", "Caducadas final"],
    ],
  },
]

/**
 * El informe de indicadores en PDF: lo mismo que la pantalla, ordenado como
 * documento. Recibe los consolidados ya hechos por la página para que las
 * cifras sean exactamente las que se están viendo.
 */
export function InformeIndicadores({
  empresa,
  periodo,
  equipo,
  filas,
  total,
  kpis,
  diasHabiles,
  comerciales,
  inversion,
  presupuesto,
  cumplimiento,
}: {
  empresa: string
  periodo: string
  /** "todo el equipo" o "3 comercial(es)". */
  equipo: string
  filas: FilaIndicadores[]
  total: FilaIndicadores
  kpis: Kpi[]
  diasHabiles: number
  /** Cuántos comerciales registraron al menos una jornada. */
  comerciales: number
  inversion: number | null
  presupuesto: number | null
  /** Solo cuando el período es un mes entero. */
  cumplimiento: { mes: string; hoy: string; facturacion: number; meta: number | null } | null
}) {
  const facturacion = facturacionTotal(total)
  const { roas, costoPorVenta } = rentabilidadPauta(facturacion, total.ventas_total, inversion)
  const reparto = repartoPorCanal(total)
  const promedios = promediosDe(total)
  const conJornada = filas.filter((f) => f.dias_laborados > 0)
  const conVentas = filas
    .filter((f) => f.ventas_total > 0)
    .sort((a, b) => b.ventas_total - a.ventas_total)

  const dias = cumplimiento ? diasCorridos(cumplimiento.mes, cumplimiento.hoy) : null
  const c =
    cumplimiento && dias
      ? cumplimientoDelMes({
          facturacion: cumplimiento.facturacion,
          meta: cumplimiento.meta,
          presupuesto,
          invertido: inversion,
          diasDelMes: dias.delMes,
          diasCorridos: dias.corridos,
        })
      : null

  const valorKpi = (k: Kpi, n: number | null) =>
    n === null ? "—" : k.unit === "porcentaje" ? formatPercent(n) : uno(n)

  const nombre: Columna<FilaIndicadores> = {
    titulo: "Comercial",
    celda: (f) => f.responsable_nombre,
  }
  const numero = ([key, titulo, esTotal]: Campo): Columna<FilaIndicadores> => ({
    titulo,
    num: true,
    total: esTotal,
    celda: (f) => formatNumber(Number(f[key] ?? 0)),
  })
  const consolidado = { ...total, responsable_nombre: "Total" }

  return (
    <Informe
      titulo="Informe de indicadores"
      empresa={empresa}
      periodo={periodo}
      detalle={`Gestión y ventas de ${equipo} · ${comerciales} comercial(es) con jornada · ${diasHabiles} días hábiles`}
    >
      <Seccion titulo="Resumen del período">
        <Cifras
          items={[
            { label: "Jornadas registradas", valor: formatNumber(total.dias_laborados), nota: `${comerciales} comercial(es)` },
            { label: "Llamadas", valor: formatNumber(total.total_llamadas), nota: `${formatNumber(total.llamadas_contestadas)} contestadas` },
            { label: "Agendas", valor: formatNumber(total.total_agendas), nota: `${formatNumber(total.atencion_agenda)} atendidas` },
            { label: "Ventas", valor: formatNumber(total.ventas_total), nota: `${total.ventas_presencial} presenciales · ${total.ventas_digital} digitales` },
            { label: "Facturación total", valor: pesos(facturacion), nota: formatCOP(facturacion), destacada: true },
          ]}
        />
      </Seccion>

      <Seccion
        titulo="Rentabilidad de la pauta"
        nota="ROAS = facturación ÷ invertido en pauta. Costo por venta = invertido ÷ ventas."
      >
        <Cifras
          items={[
            { label: "Presupuesto autorizado", valor: pesos(presupuesto), nota: presupuesto === null ? "Sin dato" : formatCOP(presupuesto) },
            {
              label: "Invertido en pauta",
              valor: pesos(inversion),
              nota: inversion === null ? "Sin dato" : presupuesto ? `${formatPercent(inversion / presupuesto)} del presupuesto` : formatCOP(inversion),
            },
            { label: "ROAS", valor: veces(roas), nota: roas === null ? "Falta lo invertido" : "Por cada peso de pauta", destacada: true },
            { label: "Costo por venta", valor: pesos(costoPorVenta), nota: costoPorVenta === null ? "—" : formatCOP(Math.round(costoPorVenta)), destacada: true },
          ]}
        />
      </Seccion>

      {c && cumplimiento && dias && (
        <Seccion
          titulo="Cumplimiento del mes"
          nota={`Día ${dias.corridos} de ${dias.delMes}, sobre días calendario y con la facturación de toda la empresa.`}
        >
          <Cifras
            columnas={4}
            items={[
              { label: "Facturación actual", valor: pesos(cumplimiento.facturacion), nota: formatCOP(cumplimiento.facturacion) },
              { label: "Meta de facturación", valor: pesos(cumplimiento.meta), nota: cumplimiento.meta === null ? "Se fija en Objetivos" : c.faltaParaMeta === 0 ? "Meta cumplida" : `Faltan ${formatCOPShort(c.faltaParaMeta!)}` },
              { label: "Promedio diario para la meta", valor: pesos(c.promedioDiarioParaMeta), nota: dias.faltantes ? `En ${dias.faltantes} día(s) que faltan` : "El mes ya cerró", destacada: true },
              { label: "Proyección lineal", valor: pesos(c.proyeccionLineal), nota: c.promedioDiario === null ? "—" : `Al ritmo de ${formatCOPShort(c.promedioDiario)} por día`, destacada: true },
              { label: "Presupuesto que se debía haber gastado", valor: pesos(c.presupuestoEsperado), nota: "Presupuesto ÷ días del mes × días corridos" },
              { label: "Falta por invertir", valor: pesos(c.faltaPorInvertir), nota: c.faltaPorInvertir !== null && c.faltaPorInvertir < 0 ? "Se pasó del presupuesto" : "Presupuesto − invertido" },
              { label: "Proyección faltante", valor: pesos(c.proyeccionFaltante), nota: "ROAS × lo que falta por invertir", destacada: true },
              { label: "Proyección total", valor: pesos(c.proyeccionTotal), nota: "Proyección faltante + facturación", destacada: true },
            ]}
          />
        </Seccion>
      )}

      <Seccion
        titulo="Indicadores con meta"
        nota="Cumplimiento = logrado ÷ meta. Verde cumple, ámbar está cerca, rojo está lejos o el dato es imposible."
        junto={false}
      >
        <Tabla
          filas={kpis}
          clave={(k) => k.code}
          columnas={[
            {
              titulo: "Indicador",
              ancho: "38%",
              celda: (k) => (
                <>
                  <b>{k.nombre}</b>
                  <small>
                    {k.formula} · {formatNumber(k.numerador)} ÷ {formatNumber(k.denominador)}
                  </small>
                </>
              ),
            },
            { titulo: "Logrado", num: true, total: true, celda: (k) => valorKpi(k, k.logrado) },
            { titulo: "Meta", num: true, celda: (k) => valorKpi(k, k.meta) },
            { titulo: "Cumplimiento", num: true, celda: (k) => formatPercent(k.efectividad, 1) },
            { titulo: "", ancho: "17%", celda: (k) => <Barra valor={leerKpi(k).avance} tono={leerKpi(k).tono} /> },
            { titulo: "Estado", celda: (k) => <Pildora tono={leerKpi(k).tono}>{leerKpi(k).etiqueta}</Pildora> },
          ]}
        />
      </Seccion>

      <div className="inf-dos inf-junto">
        <Seccion titulo="Validación de ventas" nota="Lo que dice la base de ventas contra lo tipificado en gestión diaria.">
          <Tabla
            filas={[
              { tipo: "Presencial", base: total.ventas_presencial, gestion: total.atencion_venta + total.atencion_venta_externa },
              { tipo: "Digital", base: total.ventas_digital, gestion: total.llamada_efectiva },
            ]}
            clave={(f) => f.tipo}
            pie={{
              tipo: "Total",
              base: total.ventas_presencial + total.ventas_digital,
              gestion: total.atencion_venta + total.atencion_venta_externa + total.llamada_efectiva,
            }}
            columnas={[
              { titulo: "Tipo", celda: (f) => f.tipo },
              { titulo: "Ventas", num: true, celda: (f) => formatNumber(f.base) },
              { titulo: "Gestión", num: true, celda: (f) => formatNumber(f.gestion) },
              {
                titulo: "Diferencia",
                num: true,
                celda: (f) => (
                  <Pildora tono={f.gestion === f.base ? "verde" : "ambar"}>
                    {f.gestion === f.base ? "Coincide" : `${f.gestion - f.base > 0 ? "+" : ""}${f.gestion - f.base}`}
                  </Pildora>
                ),
              },
            ]}
          />
        </Seccion>

        <Seccion titulo="Canal y promedios" nota="Reparto de las ventas y promedios por jornada registrada.">
          <Tabla
            filas={[
              { label: "Ventas presenciales", valor: `${formatNumber(reparto.presencial.cantidad)} · ${formatPercent(reparto.presencial.ratio)}` },
              { label: "Ventas digitales", valor: `${formatNumber(reparto.digital.cantidad)} · ${formatPercent(reparto.digital.ratio)}` },
              { label: "Agendas por jornada", valor: uno(promedios.agendas) },
              { label: "Llamadas contestadas por jornada", valor: uno(promedios.contestadas) },
              { label: "Atención presencial por jornada", valor: uno(promedios.atencion_presencial) },
            ]}
            clave={(f) => f.label}
            columnas={[
              { titulo: "Dato", celda: (f) => f.label },
              { titulo: "Valor", num: true, total: true, celda: (f) => f.valor },
            ]}
          />
        </Seccion>
      </div>

      <Seccion titulo="Ventas por comercial" nota="Cuántas ventas hizo cada quien y cuánto facturó." junto={false}>
        <Tabla
          filas={conVentas}
          clave={(f) => f.staff_id ?? "sin"}
          pie={consolidado}
          vacio="Sin ventas en el período."
          columnas={[
            nombre,
            numero(["ventas_presencial", "Presencial"]),
            numero(["ventas_digital", "Digital"]),
            numero(["ventas_sin_tipo", "Sin tipo"]),
            numero(["ventas_total", "Total", true]),
            { titulo: "Valor final", num: true, celda: (f) => formatCOP(f.valor_final) },
            { titulo: "Facturación total", num: true, total: true, celda: (f) => formatCOP(facturacionTotal(f)) },
          ]}
        />
      </Seccion>

      {BLOQUES.map((b) => (
        <Seccion key={b.titulo} titulo={`Gestión por comercial · ${b.titulo}`} junto={conJornada.length <= 14}>
          <Tabla
            filas={conJornada}
            clave={(f) => f.staff_id ?? "sin"}
            pie={consolidado}
            vacio="Nadie registró jornada en el período."
            columnas={[nombre, ...b.campos.map(numero)]}
          />
        </Seccion>
      ))}
    </Informe>
  )
}
