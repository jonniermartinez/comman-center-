/**
 * Pinta los rótulos y las tarjetas del video como PNG, con Chromium.
 *
 * El ffmpeg de Homebrew viene sin `drawtext`, y de todos modos un HTML da
 * mejor tipografía que un filtro. Lee rotulos.json (lo escribe montar.py) y
 * deja un PNG por entrada en la misma carpeta.
 */
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const archivo = process.argv[2]
const items = JSON.parse(fs.readFileSync(archivo, "utf8"))
const carpeta = path.dirname(archivo)

const FUENTE = `font-family: 'Geist', 'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif;`

function rotulo(texto) {
  return `<div style="position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:96px;${FUENTE}">
    <div style="display:flex;align-items:center;gap:14px;background:rgba(15,23,42,.86);color:#fff;font-size:30px;font-weight:600;letter-spacing:-.01em;padding:14px 26px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25)">
      <span style="width:10px;height:10px;border-radius:50%;background:#2dd4bf;display:inline-block"></span>${texto}
    </div></div>`
}
function tarjeta(lineas) {
  const [titulo, ...resto] = lineas
  return `<div style="position:fixed;inset:0;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;color:#fff;${FUENTE}">
    <div style="font-size:${titulo.length > 30 ? 56 : 104}px;font-weight:700;letter-spacing:-.03em;text-align:center;max-width:1500px;line-height:1.1">${titulo}</div>
    ${resto.map((t) => `<div style="font-size:34px;color:#94a3b8;text-align:center;max-width:1400px">${t}</div>`).join("")}
    <div style="position:absolute;bottom:64px;display:flex;align-items:center;gap:12px;color:#64748b;font-size:22px"><span style="width:10px;height:10px;border-radius:50%;background:#2dd4bf"></span>Command Center</div>
  </div>`
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
for (const it of items) {
  const html = it.tipo === "tarjeta" ? tarjeta(it.lineas) : rotulo(it.texto)
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${html}</body></html>`)
  await page.screenshot({ path: path.join(carpeta, it.png), omitBackground: it.tipo !== "tarjeta" })
}
await browser.close()
console.log(`${items.length} rótulos pintados en ${carpeta}`)
