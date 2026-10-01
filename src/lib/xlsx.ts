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
  /** Líneas sueltas encima de la tabla: título, período, fecha de exportación. */
  encabezado?: string[]
  columnas: { titulo: string; ancho?: number }[]
  filas: Celda[][]
}

const ESTILO = { normal: 0, negrita: 1, fecha: 2, pesos: 3 } as const

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

function celda(valor: Celda, ref: string, estilo: number = ESTILO.normal): string {
  if (valor === null || valor === undefined || valor === "") return ""
  if (typeof valor === "object") {
    if ("fecha" in valor) {
      const n = serial(valor.fecha)
      return n === null ? "" : `<c r="${ref}" s="${ESTILO.fecha}"><v>${n}</v></c>`
    }
    return Number.isFinite(valor.pesos)
      ? `<c r="${ref}" s="${ESTILO.pesos}"><v>${valor.pesos}</v></c>`
      : ""
  }
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? `<c r="${ref}" s="${estilo}"><v>${valor}</v></c>` : ""
  }
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`
}

function hojaXml(hoja: HojaXlsx): string {
  const filas: string[] = []
  let n = 0
  const fila = (celdas: Celda[], estilo?: number) => {
    n++
    filas.push(
      `<row r="${n}">${celdas.map((c, i) => celda(c, `${letra(i)}${n}`, estilo)).join("")}</row>`,
    )
  }

  for (const linea of hoja.encabezado ?? []) fila([linea], ESTILO.negrita)
  if (hoja.encabezado?.length) n++ // una fila en blanco antes de la tabla
  fila(hoja.columnas.map((c) => c.titulo), ESTILO.negrita)
  const filaTitulos = n
  for (const f of hoja.filas) fila(f)

  const cols = hoja.columnas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho ?? 16}" customWidth="1"/>`)
    .join("")

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    // Los títulos de la tabla quedan fijos al bajar por el listado.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${filaTitulos}" topLeftCell="A${filaTitulos + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${filas.join("")}</sheetData>` +
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

// Los cuatro estilos de `ESTILO`, en ese orden: normal, negrita, fecha y pesos.
const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`

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
