/**
 * Graba las escenas del video demo con Playwright.
 *
 * Cada escena es un contexto aparte con su propio video, así el montaje
 * (montar.sh) puede acelerar o recortar cada una por separado. Se graba con un
 * cursor pintado encima de la página —Playwright no lo dibuja— y tecleo real,
 * para que se vea como una persona usando el sistema.
 *
 * Uso:
 *   DEMO_ENV=ruta/a/demo.env DEMO_OUT=ruta/salida node tools/demo/grabar.mjs
 *
 * demo.env lleva DEMO_EMAIL y DEMO_PASSWORD de una cuenta super admin de
 * prueba. Lo que se crea (una empresa) se borra después con limpiar.sql.
 */
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000"
const OUT = process.env.DEMO_OUT ?? "tools/demo/salida"
const ENV = process.env.DEMO_ENV ?? "tools/demo/demo.env"
const EMPRESA_REAL = process.env.DEMO_EMPRESA ?? "lv"
const MES_PASADO = "2026-08-01"
const MES_ACTUAL = "2026-09-01"
const DEMO_NOMBRE = "Demo Buga"
const DEMO_SLUG = "demo-buga"
const HOY = new Date().toISOString().slice(0, 10)

const env = Object.fromEntries(
  fs.readFileSync(ENV, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=")
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  }),
)

fs.mkdirSync(OUT, { recursive: true })
const RAW = path.join(OUT, "raw")
fs.mkdirSync(RAW, { recursive: true })
const STATE = path.join(OUT, "sesion.json")

const CURSOR = `
(() => {
  if (window.top !== window) return
  const c = document.createElement("div")
  c.id = "__cursor"
  c.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2 L3 24 L8.5 18.5 L12.5 27 L16.5 25 L12.5 17 L20 17 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  Object.assign(c.style, { position: "fixed", left: "-100px", top: "-100px", zIndex: 2147483647, pointerEvents: "none", transition: "transform 40ms linear" })
  const r = document.createElement("div")
  Object.assign(r.style, { position: "fixed", width: "36px", height: "36px", borderRadius: "50%", border: "3px solid #0f766e", zIndex: 2147483646, pointerEvents: "none", opacity: 0, transform: "translate(-50%,-50%) scale(.4)" })
  const add = () => { document.documentElement.appendChild(c); document.documentElement.appendChild(r) }
  if (document.documentElement) add(); else document.addEventListener("DOMContentLoaded", add)
  let x = 0, y = 0
  document.addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; c.style.transform = "translate(" + (x - 3) + "px," + (y - 2) + "px)"; c.style.left = "0"; c.style.top = "0" }, true)
  document.addEventListener("mousedown", () => {
    r.style.left = x + "px"; r.style.top = y + "px"
    r.style.transition = "none"; r.style.opacity = 0.9; r.style.transform = "translate(-50%,-50%) scale(.4)"
    requestAnimationFrame(() => { r.style.transition = "all 380ms ease-out"; r.style.opacity = 0; r.style.transform = "translate(-50%,-50%) scale(1.6)" })
  }, true)
})()`

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

async function mover(page, loc, steps = 22) {
  await loc.first().scrollIntoViewIfNeeded()
  const box = await loc.first().boundingBox()
  if (!box) throw new Error("sin caja para mover el cursor")
  const x = box.x + Math.min(box.width / 2, 120)
  const y = box.y + box.height / 2
  await page.mouse.move(x, y, { steps })
  return { x, y }
}
async function clic(page, loc, steps) {
  const { x, y } = await mover(page, loc, steps)
  await pausa(120)
  await page.mouse.click(x, y)
}
async function escribir(page, sel, texto, delay = 38) {
  const loc = page.locator(sel)
  await clic(page, loc)
  await loc.fill("")
  await loc.pressSequentially(texto, { delay })
}
async function elegir(page, id, opcion) {
  await clic(page, page.locator(`#${id}`))
  const op = opcion
    ? page.getByRole("option", { name: opcion }).first()
    : page.getByRole("option").first()
  await op.waitFor({ state: "visible" })
  await pausa(350)
  await clic(page, op, 12)
}
async function abrir(page, boton, titulo) {
  const b = page.getByRole("button", { name: boton }).first()
  await b.waitFor({ state: "visible" })
  for (let i = 0; i < 4; i++) {
    await clic(page, b)
    try {
      await page.getByRole("dialog").getByText(titulo).first().waitFor({ state: "visible", timeout: 4000 })
      return
    } catch { await pausa(800) }
  }
  throw new Error(`no abrió ${titulo}`)
}
async function guardar(page, boton = /Guardar|Registrar|Crear|Agregar/) {
  await clic(page, page.getByRole("dialog").getByRole("button", { name: boton }).last())
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 30000 })
}
async function desplazar(page, total, pasos = 12, cada = 220) {
  for (let i = 0; i < pasos; i++) {
    await page.mouse.wheel(0, total / pasos)
    await pausa(cada)
  }
}
/** Si la barra superior no está en el mes pedido (YYYY-MM), retrocede con la flecha. */
async function asegurarMes(page, mes) {
  const input = page.getByLabel("Elegir mes")
  for (let i = 0; i < 6; i++) {
    const actual = await input.inputValue().catch(() => "")
    if (actual === mes) return
    await clic(page, page.getByRole("button", { name: actual > mes ? "Mes anterior" : "Mes siguiente" }))
    await page.waitForLoadState("networkidle")
    await pausa(1200)
  }
}
/** Desplaza suavemente hasta dejar un texto cerca del borde superior. */
async function llevarA(page, texto, margen = 90) {
  await page.evaluate(([t, m]) => {
    const el = [...document.querySelectorAll("h1,h2,h3,h4,[data-slot=card-title],div,p")].find((e) => e.childElementCount === 0 && e.textContent.trim() === t)
    if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - m, behavior: "smooth" })
  }, [texto, margen])
  await pausa(1400)
}
async function ir(page, ruta) {
  await page.goto(BASE + ruta, { waitUntil: "networkidle" })
  await page.locator("h1:visible").first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {})
}

const browser = await chromium.launch()
const escenas = []

const DESDE = process.env.DEMO_DESDE ?? ""
const HASTA = process.env.DEMO_HASTA ?? ""
async function escena(nombre, mes, fn, { sesion = true } = {}) {
  if (nombre < DESDE) return
  if (HASTA && nombre.slice(0, 2) > HASTA) return
  const t0 = Date.now()
  const contexto = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    recordVideo: { dir: RAW, size: { width: 1920, height: 1080 } },
    ...(sesion && fs.existsSync(STATE) ? { storageState: STATE } : {}),
  })
  await contexto.addCookies([{ name: "cc_mes", value: mes, url: BASE }])
  await contexto.addInitScript(CURSOR)
  const page = await contexto.newPage()
  await page.mouse.move(960, 540)
  let error = null
  try {
    await fn(page, contexto)
  } catch (e) {
    error = e
    console.error(`✗ escena ${nombre}:`, e.message)
    await page.screenshot({ path: path.join(OUT, `error-${nombre}.png`) }).catch(() => {})
  }
  await pausa(900)
  const video = page.video()
  await contexto.close()
  const destino = path.join(RAW, `${nombre}.webm`)
  await video.saveAs(destino)
  await video.delete().catch(() => {})
  const dur = ((Date.now() - t0) / 1000).toFixed(1)
  escenas.push({ nombre, dur, ok: !error })
  console.log(`${error ? "✗" : "✓"} ${nombre} (${dur}s)`)
  if (error) throw error
}

// 01 · Entrar
await escena("01-login", MES_ACTUAL, async (page, contexto) => {
  await ir(page, "/login")
  await pausa(600)
  await escribir(page, "#email", env.DEMO_EMAIL, 28)
  await escribir(page, "#password", env.DEMO_PASSWORD, 22)
  await pausa(300)
  await clic(page, page.getByRole("button", { name: /Entrar|Ingresar|Iniciar/ }))
  await page.waitForURL(/\/empresas/, { timeout: 45000 })
  await page.locator("h1:visible").first().waitFor()
  await pausa(1200)
  await contexto.storageState({ path: STATE })
}, { sesion: false })

// 02 · Empresas: de septiembre a agosto, y entrar a una empresa
await escena("02-empresas", MES_ACTUAL, async (page) => {
  await ir(page, "/empresas")
  await pausa(1500)
  await clic(page, page.getByRole("button", { name: "Mes anterior" }))
  await page.waitForLoadState("networkidle")
  await pausa(2200)
  const tarjeta = page.locator("h2", { hasText: /^LV$/ }).first()
  await mover(page, tarjeta)
  await pausa(700)
  await clic(page, page.locator(`a[href="/e/${EMPRESA_REAL}"]`))
  await page.waitForURL(/\/e\//, { timeout: 30000 })
  await page.locator("h1:visible").first().waitFor()
  await pausa(1500)
})

// 03 · Dashboard con las cifras de agosto
await escena("03-dashboard", MES_PASADO, async (page) => {
  await ir(page, `/e/${EMPRESA_REAL}`)
  await pausa(800)
  await asegurarMes(page, "2026-08")
  await pausa(2200)
  await page.mouse.move(1300, 620, { steps: 30 })
  await desplazar(page, 620, 8, 200)
  await pausa(1600)
  await page.mouse.move(700, 700, { steps: 25 })
  await llevarA(page, "Por sede")
  await pausa(1800)
  await llevarA(page, "Ranking de comerciales")
  await pausa(2200)
})

// 04 · Objetivos
await escena("04-objetivos", MES_PASADO, async (page) => {
  await ir(page, `/e/${EMPRESA_REAL}/objetivos`)
  await pausa(600)
  await asegurarMes(page, "2026-08")
  await pausa(2000)
  await page.mouse.move(900, 500, { steps: 25 })
  await desplazar(page, 700, 8, 240)
  await pausa(1500)
})

// 05 · Nueva empresa (asistente)
await escena("05-nueva-empresa", MES_ACTUAL, async (page) => {
  await ir(page, "/empresas/nueva")
  await pausa(800)
  await escribir(page, "#name", DEMO_NOMBRE)
  await escribir(page, "#nit", "901.555.222-3", 30)
  await escribir(page, "#crm", "CRM Demo", 30)
  await pausa(500)
  for (let paso = 0; paso < 3; paso++) {
    await clic(page, page.getByRole("button", { name: "Siguiente" }))
    await pausa(1300)
  }
  const crear = page.getByRole("button", { name: /Crear empresa/ })
  await crear.waitFor({ state: "visible" })
  await pausa(600)
  await clic(page, crear)
  await page.waitForURL(/\/e\//, { timeout: 45000 })
  await page.locator("h1:visible").first().waitFor()
  await pausa(1500)
})

// 06 · Sedes
await escena("06-sedes", MES_ACTUAL, async (page) => {
  await ir(page, `/e/${DEMO_SLUG}/sedes`)
  await pausa(900)
  await abrir(page, /Nueva sede/, /Nueva sede/)
  await escribir(page, "#nombre", "Sede Tuluá")
  await pausa(400)
  await guardar(page)
  await pausa(1600)
})

// 07 · Equipo
await escena("07-equipo", MES_ACTUAL, async (page) => {
  await ir(page, `/e/${DEMO_SLUG}/usuarios`)
  await pausa(900)
  await abrir(page, /Agregar comercial/, /Agregar comercial/)
  await escribir(page, "#nombre", "Gómez Laura")
  await elegir(page, "sede", /Tuluá/)
  await pausa(400)
  await guardar(page)
  await pausa(1600)
})

// 08 · Ventas
await escena("08-ventas", MES_ACTUAL, async (page) => {
  await ir(page, `/e/${DEMO_SLUG}/ventas`)
  await pausa(900)
  await abrir(page, /Nueva venta/, /Nueva venta/)
  await elegir(page, "sede", /Tuluá/)
  await elegir(page, "responsable", /Gómez/)
  await escribir(page, "#nombre", "Carlos Pérez")
  await escribir(page, "#documento", "1112345678", 28)
  await escribir(page, "#celular", "3157654321", 28)
  await elegir(page, "financiacion")
  await escribir(page, "#valor", "1850000", 45)
  await pausa(500)
  await guardar(page)
  await pausa(1800)
})

// 09 · Pagos
await escena("09-pagos", MES_ACTUAL, async (page) => {
  await ir(page, `/e/${DEMO_SLUG}/pagos`)
  await pausa(900)
  await abrir(page, /Registrar pago/, /Registrar pago/)
  await escribir(page, "#buscar", "Carlos")
  await page.keyboard.press("Enter")
  const resultado = page.getByRole("dialog").locator("button", { hasText: /Carlos Pérez/ }).first()
  await resultado.waitFor({ state: "visible", timeout: 20000 })
  await pausa(500)
  await clic(page, resultado)
  await pausa(500)
  await escribir(page, "#monto", "500000", 45)
  await elegir(page, "medio")
  await pausa(400)
  await guardar(page)
  await pausa(1800)
})

// 10 · Gestión diaria
await escena("10-gestion-diaria", MES_ACTUAL, async (page) => {
  await ir(page, `/e/${DEMO_SLUG}/gestion-diaria`)
  await pausa(900)
  await abrir(page, /Registrar jornada/, /Registrar jornada/)
  await elegir(page, "persona", /Gómez/)
  await elegir(page, "sede", /Tuluá/)
  for (const [id, v] of [["ll-cont", "38"], ["ll-nocont", "11"], ["ll-agen", "7"]]) {
    await escribir(page, `#${id}`, v, 60)
  }
  await clic(page, page.getByRole("tab", { name: "Agendas" }))
  await escribir(page, "#ag-conf", "5", 60)
  await clic(page, page.getByRole("tab", { name: "Atención" }))
  await escribir(page, "#at-venta", "2", 60)
  await pausa(500)
  await guardar(page)
  await pausa(1800)
})

// 11 · Agendas
await escena("11-agendas", MES_ACTUAL, async (page) => {
  await ir(page, `/e/${DEMO_SLUG}/agendas`)
  await pausa(900)
  await abrir(page, /Nueva agenda/, /Nueva agenda/)
  await elegir(page, "sede", /Tuluá/)
  await elegir(page, "responsable", /Gómez/)
  await page.locator("#hora").fill("10:30")
  await escribir(page, "#nombre", "Andrea Ruiz")
  await escribir(page, "#celular", "3009876543", 28)
  await pausa(400)
  await guardar(page)
  await pausa(1800)
})

// 12 · Caja
await escena("12-caja", MES_ACTUAL, async (page) => {
  await ir(page, `/e/${DEMO_SLUG}/caja`)
  await pausa(900)
  await abrir(page, /Nuevo movimiento/, /Nuevo movimiento/)
  await elegir(page, "sede", /Tuluá/)
  await elegir(page, "concepto")
  await escribir(page, "#monto", "250000", 45)
  await escribir(page, "#nombre", "Papelería El Punto")
  await pausa(400)
  await guardar(page)
  await pausa(1800)
})

// 13 · El dashboard de la empresa nueva ya refleja lo capturado
await escena("13-dashboard-demo", MES_ACTUAL, async (page) => {
  await ir(page, `/e/${DEMO_SLUG}`)
  await pausa(2500)
  await page.mouse.move(1200, 600, { steps: 25 })
  await desplazar(page, 700, 8, 240)
  await pausa(1500)
})

// 14 · Auditoría
await escena("14-auditoria", MES_ACTUAL, async (page) => {
  await ir(page, "/admin/auditoria")
  await pausa(2500)
  await page.mouse.move(900, 600, { steps: 25 })
  await desplazar(page, 500, 6, 240)
  await pausa(1500)
})

await browser.close()
fs.writeFileSync(path.join(OUT, "escenas.json"), JSON.stringify(escenas, null, 2))
console.log("Listo:", escenas.length, "escenas en", RAW)
