import { Barra, Cifras, Informe, Seccion, Tabla } from "@/components/informes/informe"
import type { DashboardData } from "@/lib/data/dashboard"
import { formatCOP, formatCOPShort, formatNumber, formatPercent } from "@/lib/format"
import { rentabilidadPauta } from "@/lib/indicadores"

const pesos = (n: number | null) => (n === null ? "—" : formatCOPShort(n))

/**
 * La evolución del mes, dibujada como SVG fijo en vez de reutilizar la gráfica
 * interactiva de la pantalla: aquella se mide con el ancho de la ventana y en
 * papel sale cortada o vacía. Dos barras por día, facturado y recaudado.
 */
function EvolucionDiaria({ datos }: { datos: DashboardData["serieDiaria"] }) {
  if (datos.length === 0) return <p className="inf-vacio">Sin movimiento en el mes.</p>

  const W = 744
  const H = 190
  const izq = 46
  const abajo = 20
  const arriba = 8
  const alto = H - abajo - arriba
  const tope = Math.max(...datos.map((d) => Math.max(d.facturacion, d.recaudo)), 1)
  const paso = (W - izq) / datos.length
  const barra = Math.min(9, paso * 0.36)
  const y = (v: number) => arriba + alto - (v / tope) * alto
  const guias = [0, 0.5, 1]

  return (
    <figure className="inf-grafica">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Facturación y recaudo por día">
        {guias.map((g) => (
          <g key={g}>
            <line x1={izq} x2={W} y1={y(tope * g)} y2={y(tope * g)} className="inf-guia" />
            <text x={izq - 6} y={y(tope * g) + 3} textAnchor="end" className="inf-eje">
              {g === 0 ? "0" : formatCOPShort(tope * g)}
            </text>
          </g>
        ))}
        {datos.map((d, i) => {
          const cx = izq + paso * i + paso / 2
          return (
            <g key={d.dia}>
              <rect x={cx - barra - 0.5} y={y(d.facturacion)} width={barra} height={arriba + alto - y(d.facturacion)} rx="1.5" fill="var(--chart-1)" />
              <rect x={cx + 0.5} y={y(d.recaudo)} width={barra} height={arriba + alto - y(d.recaudo)} rx="1.5" fill="var(--chart-2)" />
              <text x={cx} y={H - 6} textAnchor="middle" className="inf-eje">
                {d.dia}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>
        <span>
          <i style={{ background: "var(--chart-1)" }} /> Facturado
        </span>
        <span>
          <i style={{ background: "var(--chart-2)" }} /> Recaudado
        </span>
      </figcaption>
    </figure>
  )
}

/** El dashboard del mes en PDF: el mismo contenido de la pantalla, como documento. */
export function InformeDashboard({
  empresa,
  periodo,
  datos,
}: {
  empresa: string
  periodo: string
  datos: DashboardData
}) {
  const t = datos.totales
  const { roas, costoPorVenta } = rentabilidadPauta(t.facturacion, t.ventas, datos.inversionPauta)
  const topeEmbudo = Math.max(...datos.embudo.map((p) => p.valor), 1)
  const embudo = datos.embudo.map((p, i) => {
    const anterior = i > 0 ? datos.embudo[i - 1].valor : null
    return { ...p, i, paso: anterior && anterior > 0 ? p.valor / anterior : null }
  })

  return (
    <Informe
      titulo="Informe del mes"
      empresa={empresa}
      periodo={periodo}
      detalle="Resultados del mes, a partir de las ventas y los pagos registrados."
    >
      <Seccion titulo="Resultados del mes">
        <Cifras
          items={[
            { label: "Ventas", valor: formatNumber(t.ventas) },
            { label: "Licencias", valor: formatNumber(t.licencias) },
            { label: "Renovaciones", valor: formatNumber(t.renovaciones) },
            { label: "Facturación", valor: pesos(t.facturacion), nota: formatCOP(t.facturacion), destacada: true },
            {
              label: "Recaudo",
              valor: pesos(t.recaudo),
              nota: t.facturacion ? `${formatPercent(t.recaudo / t.facturacion)} de lo facturado` : formatCOP(t.recaudo),
              destacada: true,
            },
          ]}
        />
      </Seccion>

      <Seccion
        titulo="Rentabilidad de la pauta"
        nota="ROAS = facturación ÷ invertido en pauta. Costo por venta = invertido ÷ ventas."
      >
        <Cifras
          items={[
            { label: "Presupuesto autorizado", valor: pesos(datos.presupuestoPauta), nota: datos.presupuestoPauta === null ? "Sin dato" : formatCOP(datos.presupuestoPauta) },
            { label: "Invertido en pauta", valor: pesos(datos.inversionPauta), nota: datos.inversionPauta === null ? "Sin dato" : formatCOP(datos.inversionPauta) },
            {
              label: "ROAS",
              valor: roas === null ? "—" : `${roas.toLocaleString("es-CO", { maximumFractionDigits: 1 })}×`,
              nota: roas === null ? "Falta lo invertido" : "Por cada peso de pauta",
              destacada: true,
            },
            { label: "Costo por venta", valor: pesos(costoPorVenta), nota: costoPorVenta === null ? "—" : formatCOP(Math.round(costoPorVenta)), destacada: true },
          ]}
        />
      </Seccion>

      <Seccion titulo={`Evolución de ${periodo}`} nota="Lo facturado y lo efectivamente recaudado, día por día.">
        <EvolucionDiaria datos={datos.serieDiaria} />
      </Seccion>

      <Seccion titulo="Embudo de la gestión" nota="De la llamada a la venta. El porcentaje es lo que pasa de un paso al siguiente.">
        <Tabla
          filas={embudo}
          clave={(p) => p.nombre}
          columnas={[
            { titulo: "Paso", ancho: "22%", celda: (p) => p.nombre },
            { titulo: "Cantidad", num: true, total: true, ancho: "14%", celda: (p) => formatNumber(p.valor) },
            { titulo: "Del paso anterior", num: true, ancho: "18%", celda: (p) => formatPercent(p.paso) },
            { titulo: "", celda: (p) => <Barra valor={(p.valor / topeEmbudo) * 100} color={`var(--chart-${(p.i % 5) + 1})`} /> },
          ]}
        />
      </Seccion>

      <div className="inf-dos inf-junto">
        <Seccion titulo="Ventas por financiación">
          <Tabla
            filas={datos.porFinanciacion}
            clave={(f, i) => f.financing_code ?? `sin-${i}`}
            vacio="Sin ventas en el mes."
            columnas={[
              { titulo: "Financiación", celda: (f) => f.financing_name ?? "Sin definir" },
              { titulo: "Ventas", num: true, celda: (f) => formatNumber(f.ventas) },
              { titulo: "Lic.", num: true, celda: (f) => formatNumber(f.licencias) },
              { titulo: "Facturación", num: true, total: true, celda: (f) => formatCOP(f.facturacion) },
            ]}
          />
        </Seccion>
        <Seccion titulo="Recaudo por medio de pago">
          <Tabla
            filas={datos.porMedioPago}
            clave={(m, i) => m.method_code ?? `sin-${i}`}
            vacio="Sin pagos en el mes."
            columnas={[
              { titulo: "Medio de pago", celda: (m) => m.nombre },
              { titulo: "Pagos", num: true, celda: (m) => formatNumber(m.pagos) },
              { titulo: "Valor", num: true, total: true, celda: (m) => formatCOP(m.amount) },
            ]}
          />
        </Seccion>
      </div>

      {datos.porSede.length > 1 && (
        <Seccion titulo="Por sede">
          <Tabla
            filas={datos.porSede}
            clave={(s) => s.branch_id}
            columnas={[
              { titulo: "Sede", celda: (s) => s.branch_name },
              { titulo: "Comerciales", num: true, celda: (s) => formatNumber(s.comerciales) },
              { titulo: "Ventas", num: true, celda: (s) => formatNumber(s.ventas_mes) },
              { titulo: "Facturación", num: true, total: true, celda: (s) => formatCOP(s.facturacion_mes) },
              { titulo: "Recaudo", num: true, celda: (s) => formatCOP(s.recaudo_mes) },
              { titulo: "Contactabilidad", num: true, celda: (s) => formatPercent(s.ratio_contactabilidad) },
            ]}
          />
        </Seccion>
      )}

      <Seccion titulo="Ranking de comerciales" nota="La gestión del mes por persona, de más a menos llamadas." junto={datos.ranking.length <= 14}>
        <Tabla
          filas={datos.ranking}
          clave={(r) => r.staff_id}
          vacio="Nadie registró gestión en el mes."
          columnas={[
            { titulo: "Comercial", celda: (r) => r.responsable_nombre },
            { titulo: "Días", num: true, celda: (r) => formatNumber(r.dias_reportados) },
            { titulo: "Tarde", num: true, celda: (r) => formatNumber(r.dias_tarde) },
            { titulo: "Llamadas", num: true, total: true, celda: (r) => formatNumber(r.total_llamadas) },
            { titulo: "Contestadas", num: true, celda: (r) => formatNumber(r.llamadas_contestadas) },
            { titulo: "Ventas x llamada", num: true, celda: (r) => formatNumber(r.llamada_efectiva) },
            { titulo: "Atenciones", num: true, celda: (r) => formatNumber(r.total_atencion) },
            { titulo: "Contactab.", num: true, celda: (r) => formatPercent(r.ratio_contactabilidad) },
            { titulo: "Conversión", num: true, celda: (r) => formatPercent(r.ratio_conversion_llamada) },
          ]}
        />
      </Seccion>
    </Informe>
  )
}
