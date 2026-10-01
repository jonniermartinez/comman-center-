import { FechaExportacion } from "@/components/informes/fecha-exportacion"
import { APP_NAME } from "@/lib/branding"
import { cn } from "@/lib/utils"

/*
 * Las piezas con las que se arman los informes en PDF.
 *
 * Un informe no es la pantalla impresa: es un documento aparte, pensado para
 * una hoja A4 vertical, que solo existe al imprimir (`.informe` está oculto en
 * pantalla y la pantalla está oculta en papel). Toma los colores del tema
 * activo, así que sale claro u oscuro según lo esté usando la persona. La
 * maquetación —medidas en puntos, saltos de hoja, pie fijo— vive en
 * globals.css bajo `.informe`.
 */

export function Informe({
  titulo,
  empresa,
  periodo,
  detalle,
  children,
}: {
  /** Qué informe es: "Informe de indicadores". */
  titulo: string
  empresa: string
  periodo: string
  /** A qué equipo o filtro corresponde. */
  detalle?: string
  children: React.ReactNode
}) {
  return (
    <article className="informe">
      <header className="inf-cab">
        <div className="inf-cab-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/command-center-simbolo.png" alt="" />
          <div>
            <p className="inf-sobre">
              {APP_NAME} · {titulo}
            </p>
            <h1>{empresa}</h1>
            {detalle && <p className="inf-nota">{detalle}</p>}
          </div>
        </div>
        <dl className="inf-cab-datos">
          <div>
            <dt>Período</dt>
            <dd className="inf-fuerte">{periodo}</dd>
          </div>
          <div>
            <dt>Exportado</dt>
            <dd>
              <FechaExportacion />
            </dd>
          </div>
        </dl>
      </header>

      {children}

      <p className="inf-pie">
        <span>
          {APP_NAME} · {titulo} · {empresa} · {periodo}
        </span>
        <span>
          Exportado el <FechaExportacion />
        </span>
      </p>
    </article>
  )
}

/** Un bloque del informe, con su título. `junto` evita que se parta entre hojas. */
export function Seccion({
  titulo,
  nota,
  junto = true,
  className,
  children,
}: {
  titulo: string
  nota?: string
  junto?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("inf-sec", junto && "inf-junto", className)}>
      <div className="inf-sec-titulo">
        <h2>{titulo}</h2>
        {nota && <p className="inf-nota">{nota}</p>}
      </div>
      {children}
    </section>
  )
}

export interface Cifra {
  label: string
  valor: string
  nota?: string
  destacada?: boolean
}

/** Una fila de cifras: las placas del resumen. */
export function Cifras({ items, columnas }: { items: Cifra[]; columnas?: number }) {
  return (
    <dl
      className="inf-cifras"
      style={{ gridTemplateColumns: `repeat(${columnas ?? items.length}, minmax(0, 1fr))` }}
    >
      {items.map((c) => (
        <div key={c.label} className={cn("inf-cifra", c.destacada && "inf-cifra-destacada")}>
          <dt>{c.label}</dt>
          <dd>{c.valor}</dd>
          {c.nota && <p>{c.nota}</p>}
        </div>
      ))}
    </dl>
  )
}

export type TonoInforme = "verde" | "ambar" | "rojo" | "neutro"

export function Pildora({ tono, children }: { tono: TonoInforme; children: React.ReactNode }) {
  return <span className={cn("inf-pildora", `inf-${tono}`)}>{children}</span>
}

/** Una barra de avance, de 0 a 100. */
export function Barra({ valor, tono, color }: { valor: number; tono?: TonoInforme; color?: string }) {
  return (
    <span className="inf-barra">
      <i
        className={tono ? `inf-${tono}` : undefined}
        style={{ width: `${Math.max(0, Math.min(100, valor))}%`, background: color }}
      />
    </span>
  )
}

export interface Columna<T> {
  titulo: string
  /** Alineada a la derecha y con cifras tabulares. */
  num?: boolean
  /** Columna de total: va resaltada. */
  total?: boolean
  ancho?: string
  celda: (fila: T) => React.ReactNode
}

/** Una tabla del informe. `pie` es la fila de totales. */
export function Tabla<T>({
  columnas,
  filas,
  clave,
  pie,
  vacio = "Sin datos en el período.",
}: {
  columnas: Columna<T>[]
  filas: T[]
  clave: (fila: T, i: number) => string
  pie?: T
  vacio?: string
}) {
  const clase = (c: Columna<T>) => cn(c.num && "inf-num", c.total && "inf-total")
  return (
    <table className="inf-tabla">
      <thead>
        <tr>
          {columnas.map((c) => (
            <th key={c.titulo} className={clase(c)} style={{ width: c.ancho }}>
              {c.titulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={clave(f, i)}>
            {columnas.map((c) => (
              <td key={c.titulo} className={clase(c)}>
                {c.celda(f)}
              </td>
            ))}
          </tr>
        ))}
        {filas.length === 0 && (
          <tr>
            <td colSpan={columnas.length} className="inf-vacio">
              {vacio}
            </td>
          </tr>
        )}
      </tbody>
      {pie && filas.length > 0 && (
        <tfoot>
          <tr>
            {columnas.map((c) => (
              <td key={c.titulo} className={clase(c)}>
                {c.celda(pie)}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  )
}
