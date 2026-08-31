import { defineConfig, devices } from "@playwright/test"
import { config as cargarEnv } from "dotenv"

cargarEnv({ path: ".env.e2e" })

const BASE_URL =
  process.env.E2E_BASE_URL ?? "https://comman-center.commandcentergenelypse.workers.dev"

/**
 * Las pruebas corren contra el despliegue real, no contra un servidor local.
 *
 * Es lo que se pidió y tiene sentido: lo que se quiere saber es si el sistema
 * que usa el cliente funciona, incluido el borde de Cloudflare y las políticas
 * de la base de producción. El precio es que **escriben en datos reales**, y
 * por eso todo lo que crean lleva el prefijo `e2e-` y `e2e/soporte/guardarrail.ts`
 * impide tocar cualquier otra cosa.
 */
export default defineConfig({
  testDir: "./e2e",
  // Un fallo de seguridad no se "reintenta hasta que pase": si una prueba de
  // aislamiento es inestable, eso ya es la noticia.
  retries: 0,
  // Contra producción se va con calma: son datos de verdad y un pico de
  // escrituras concurrentes no aporta nada a lo que se quiere medir.
  workers: 4,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["html", { open: "never" }], ["list"]],
  globalSetup: "./e2e/soporte/montaje.ts",
  globalTeardown: "./e2e/soporte/desmontaje.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  projects: [
    {
      name: "seguridad",
      testDir: "./e2e/seguridad",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "features",
      testDir: "./e2e/features",
      use: { ...devices["Desktop Chrome"] },
      // Las features dan por hecho que la seguridad se sostiene. Si el
      // aislamiento entre empresas está roto, lo que digan las demás sobra.
      dependencies: ["seguridad"],
    },
  ],
})
