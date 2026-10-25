// Temporal: navega la app en local con la cuenta e2e y marca la ventana de
// tiempo para contar las peticiones que llegan a Supabase. Borrar antes del commit.
import { chromium } from "@playwright/test"
import { config } from "dotenv"

config({ path: ".env.e2e" })

const BASE = "http://localhost:3001"
const RUTAS = ["/empresas", "/e/carss", "/e/carss/ventas", "/e/carss/pagos", "/e/carss/caja", "/e/carss/mi-jornada"]

const browser = await chromium.launch()
const page = await browser.newPage()
page.on("pageerror", (e) => console.log("pageerror:", e.message))

await page.goto(`${BASE}/login`)
await page.fill("#email", process.env.E2E_SUPER_ADMIN_EMAIL)
await page.fill("#password", process.env.E2E_SUPER_ADMIN_PASSWORD)
await page.click("button[type=submit]")
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 })
console.log("login ok →", page.url())

// Primera vuelta calienta el compilador de dev; la segunda es la que se mide.
for (const r of RUTAS) await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" })

const inicio = new Date().toISOString()
for (const r of RUTAS) {
  const res = await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" })
  const titulo = (await page.locator("h1").first().textContent().catch(() => "")) ?? ""
  console.log(res.status(), r, "→", titulo.trim().slice(0, 40))
}
const fin = new Date().toISOString()

// Un formulario con catálogos: deben seguir llenos.
await page.goto(`${BASE}/e/carss/ventas`, { waitUntil: "networkidle" })
const selects = await page.locator("select, [role=combobox]").count()
console.log("controles de selección en ventas:", selects)

console.log("VENTANA", inicio, fin)
await browser.close()
