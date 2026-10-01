/**
 * Un .xlsx mínimo, sin dependencias.
 *
 * Un libro de Excel es un zip con media docena de XML. Para exportar un
 * listado —una hoja, encabezado, fechas y plata— no hace falta una librería
 * de varios megas que además hay que hacer correr en Workers: alcanza con
 * escribir esos XML y comprimirlos con `CompressionStream`, que existe igual
 * en el navegador, en Node y en Cloudflare.
 */

/** Una fecha `YYYY-MM-DD`, que Excel debe ver como fecha y no como texto. */
export interface CeldaFecha {
  fecha: string
}
/** Un importe: número con separador de miles. */
export interface CeldaPesos {
  pesos: number
}
export type Celda = string | number | null | undefined | CeldaFecha | CeldaPesos

export interface HojaXlsx {
  nombre: string
  /**
   * Líneas sueltas encima de la tabla. La primera es el título y va grande;
   * las demás —período, fecha de exportación— van en gris debajo.
   */
  encabezado?: string[]
  columnas: { titulo: string; ancho?: number }[]
  filas: Celda[][]
}

/*
 * Los estilos de `styles.xml`, por posición. Los del cuerpo van de a cuatro
 * —texto, fecha, pesos, número— y se repiten con fondo para la fila alterna:
 * sumar `ALTERNA` a un estilo del cuerpo da su versión con franja.
 */
const ESTILO = {
  normal: 0,
  titulo: 1,
  dato: 2,
  cabecera: 3,
  texto: 4,
  fecha: 5,
  pesos: 6,
  numero: 7,
  totalTexto: 12,
  totalPesos: 13,
} as const
const ALTERNA = 4

function escapar(texto: string): string {
  return texto
    // Caracteres de control que XML 1.0 no admite y que dañarían el archivo.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** 0 → A, 25 → Z, 26 → AA. */
function letra(col: number): string {
  let s = ""
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  }
  return s
}

/** El número de serie de Excel para una fecha: días desde el 30/12/1899. */
function serial(fecha: string): number | null {
  const ms = Date.parse(`${fecha.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(ms) ? null : ms / 86_400_000 + 25_569
}

const esPesos = (valor: Celda): valor is CeldaPesos =>
  typeof valor === "object" && valor !== null && "pesos" in valor

function texto(valor: string, ref: string, estilo: number): string {
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`
}

/**
 * Una celda del cuerpo. Una celda vacía también se escribe, con su estilo:
 * sin eso la franja y los bordes de la fila quedarían con huecos.
 */
function celdaCuerpo(valor: Celda, ref: string, franja: number): string {
  const vacia = `<c r="${ref}" s="${ESTILO.texto + franja}"/>`
  if (valor === null || valor === undefined || valor === "") return vacia
  if (typeof valor === "object") {
    if ("fecha" in valor) {
      const n = serial(valor.fecha)
      return n === null ? vacia : `<c r="${ref}" s="${ESTILO.fecha + franja}"><v>${n}</v></c>`
    }
    return Number.isFinite(valor.pesos)
      ? `<c r="${ref}" s="${ESTILO.pesos + franja}"><v>${valor.pesos}</v></c>`
      : vacia
  }
  if (typeof valor === "number") {
    return Number.isFinite(valor)
      ? `<c r="${ref}" s="${ESTILO.numero + franja}"><v>${valor}</v></c>`
      : vacia
  }
  return texto(valor, ref, ESTILO.texto + franja)
}

function hojaXml(hoja: HojaXlsx): string {
  const filas: string[] = []
  const columnas = hoja.columnas.length
  let n = 0

  ;(hoja.encabezado ?? []).forEach((linea, i) => {
    n++
    filas.push(
      i === 0
        ? `<row r="${n}" ht="24" customHeight="1">${texto(linea, `A${n}`, ESTILO.titulo)}</row>`
        : `<row r="${n}">${texto(linea, `A${n}`, ESTILO.dato)}</row>`,
    )
  })
  if (hoja.encabezado?.length) n++ // una fila en blanco antes de la tabla

  n++
  const filaTitulos = n
  filas.push(
    `<row r="${n}" ht="30" customHeight="1">${hoja.columnas
      .map((c, i) => texto(c.titulo, `${letra(i)}${n}`, ESTILO.cabecera))
      .join("")}</row>`,
  )

  hoja.filas.forEach((f, k) => {
    n++
    const franja = k % 2 === 1 ? ALTERNA : 0
    const celdas = Array.from({ length: columnas }, (_, i) =>
      celdaCuerpo(f[i], `${letra(i)}${n}`, franja),
    )
    filas.push(`<row r="${n}">${celdas.join("")}</row>`)
  })
  const ultimaFila = n

  // La fila de totales suma cada columna de plata. Va como fórmula, para que
  // siga cuadrando si alguien filtra o corrige una celda, y con el valor ya
  // calculado, para los visores que no recalculan.
  const dePesos = hoja.columnas.map((_, i) => hoja.filas.some((f) => esPesos(f[i])))
  if (hoja.filas.length && dePesos.some(Boolean)) {
    n++
    const celdas = hoja.columnas.map((_, i) => {
      const ref = `${letra(i)}${n}`
      if (dePesos[i]) {
        const suma = hoja.filas.reduce((s, f) => s + (esPesos(f[i]) ? f[i].pesos : 0), 0)
        const rango = `${letra(i)}${filaTitulos + 1}:${letra(i)}${ultimaFila}`
        return `<c r="${ref}" s="${ESTILO.totalPesos}"><f>SUBTOTAL(109,${rango})</f><v>${suma}</v></c>`
      }
      return i === 0
        ? texto(`Total · ${hoja.filas.length.toLocaleString("es-CO")} registro(s)`, ref, ESTILO.totalTexto)
        : `<c r="${ref}" s="${ESTILO.totalTexto}"/>`
    })
    filas.push(`<row r="${n}" ht="22" customHeight="1">${celdas.join("")}</row>`)
  }

  const cols = hoja.columnas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho ?? 16}" customWidth="1"/>`)
    .join("")
  const tabla = `A${filaTitulos}:${letra(columnas - 1)}${Math.max(ultimaFila, filaTitulos)}`

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    // Los títulos de la tabla quedan fijos al bajar por el listado, y sin la
    // cuadrícula gris de Excel: los bordes los ponen las celdas.
    `<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="${filaTitulos}" topLeftCell="A${filaTitulos + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${filas.join("")}</sheetData>` +
    // Cada columna con su filtro, como una tabla de Excel.
    `<autoFilter ref="${tabla}"/>` +
    // Al imprimir: horizontal y a lo ancho de una hoja.
    `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>` +
    `<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
    `</worksheet>`
  )
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`

const RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`

/*
 * Los estilos, en el orden de `ESTILO`: título, dato del encabezado, cabecera
 * de la tabla (morado de marca, letra blanca), los cuatro del cuerpo, los
 * mismos cuatro con franja, y los dos de la fila de totales.
 */
const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;\\ #,##0;[Red]\\-&quot;$&quot;\\ #,##0"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF5B3D9C"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF5B5872"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5B3D9C"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7F5FC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDE7F8"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFDCD9EA"/></left><right style="thin"><color rgb="FFDCD9EA"/></right><top style="thin"><color rgb="FFDCD9EA"/></top><bottom style="thin"><color rgb="FFDCD9EA"/></bottom><diagonal/></border><border><left style="thin"><color rgb="FFDCD9EA"/></left><right style="thin"><color rgb="FFDCD9EA"/></right><top style="medium"><color rgb="FF5B3D9C"/></top><bottom style="thin"><color rgb="FFDCD9EA"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="14"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="14" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="3" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

function workbookXml(nombre: string): string {
  // Excel no admite estos caracteres en el nombre de una hoja, ni más de 31.
  const limpio = nombre.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Hoja1"
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapar(limpio)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`
  )
}

// ---------------------------------------------------------------- el zip

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

async function comprimir(datos: Uint8Array): Promise<Uint8Array> {
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(flujo).arrayBuffer())
}

async function zip(archivos: { ruta: string; contenido: string }[]): Promise<Uint8Array> {
  const codificar = new TextEncoder()
  const partes: Uint8Array[] = []
  const directorio: Uint8Array[] = []
  let posicion = 0

  for (const archivo of archivos) {
    const nombre = codificar.encode(archivo.ruta)
    const crudo = codificar.encode(archivo.contenido)
    const comprimido = await comprimir(crudo)
    const crc = crc32(crudo)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // versión necesaria
    local.setUint16(6, 0x0800, true) // nombres en UTF-8
    local.setUint16(8, 8, true) // deflate
    local.setUint16(10, 0, true) // hora
    local.setUint16(12, 0x21, true) // fecha: 1/1/1980
    local.setUint32(14, crc, true)
    local.setUint32(18, comprimido.length, true)
    local.setUint32(22, crudo.length, true)
    local.setUint16(26, nombre.length, true)
    local.setUint16(28, 0, true)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)
    central.setUint16(6, 20, true)
    central.setUint16(8, 0x0800, true)
    central.setUint16(10, 8, true)
    central.setUint16(12, 0, true)
    central.setUint16(14, 0x21, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, comprimido.length, true)
    central.setUint32(24, crudo.length, true)
    central.setUint16(28, nombre.length, true)
    central.setUint32(42, posicion, true)

    partes.push(new Uint8Array(local.buffer), nombre, comprimido)
    directorio.push(new Uint8Array(central.buffer), nombre)
    posicion += 30 + nombre.length + comprimido.length
  }

  const tamDirectorio = directorio.reduce((s, p) => s + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, archivos.length, true)
  fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamDirectorio, true)
  fin.setUint32(16, posicion, true)

  const todo = [...partes, ...directorio, new Uint8Array(fin.buffer)]
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0))
  let i = 0
  for (const p of todo) {
    salida.set(p, i)
    i += p.length
  }
  return salida
}

/** Arma el libro: una hoja con su encabezado, sus títulos y sus filas. */
export function crearXlsx(hoja: HojaXlsx): Promise<Uint8Array> {
  return zip([
    { ruta: "[Content_Types].xml", contenido: CONTENT_TYPES },
    { ruta: "_rels/.rels", contenido: RELS },
    { ruta: "xl/workbook.xml", contenido: workbookXml(hoja.nombre) },
    { ruta: "xl/_rels/workbook.xml.rels", contenido: WORKBOOK_RELS },
    { ruta: "xl/styles.xml", contenido: STYLES },
    { ruta: "xl/worksheets/sheet1.xml", contenido: hojaXml(hoja) },
  ])
}
