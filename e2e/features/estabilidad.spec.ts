import { anotar } from "../soporte/anotaciones";
import { expect, test } from "../soporte/fixtures";
import { BASE_URL } from "../soporte/entorno";

/**
 * ¿El despliegue sirve las páginas de forma fiable?
 *
 * Esta prueba nació de un fallo real: el 31/08/2026, montando esta misma
 * suite, el inicio de sesión se caía de forma intermitente. No era la prueba:
 * el worker devolvía 503 con "Cloudflare Error 1102 — Worker exceeded resource
 * limits" en **una de cada seis peticiones a /login**, sin concurrencia
 * ninguna. Eso le pasa a cualquiera que intente entrar.
 *
 * El resto de la suite reintenta ante ese 503 (`soporte/reintento.ts`) para
 * poder medir lo suyo. Esta prueba es la contrapartida: existe para que el
 * problema no quede escondido detrás de esos reintentos.
 *
 * Mientras falle, hay trabajo pendiente en el despliegue, no aquí.
 */

const PETICIONES = 12;
// Un 503 de cada doce ya es inaceptable para alguien intentando entrar a
// trabajar. El umbral no es "que no pase nunca" porque un pico puntual es
// tolerable; es "que no sea la norma".
const FALLOS_TOLERADOS = 1;

test.describe("Estabilidad del despliegue", () => {
  test(
    "las páginas públicas responden sin agotar el worker",
    anotar({
      modulo: "Despliegue",
      tipo: "feature",
      porque:
        "El worker devuelve 503 (Cloudflare 1102) en buena parte de las peticiones. Esta prueba existe para que no quede escondida tras los reintentos del resto.",
    }),
    async ({ request }) => {
      const fallos: number[] = [];

      for (let i = 0; i < PETICIONES; i++) {
        const respuesta = await request.get(`${BASE_URL}/login`, {
          failOnStatusCode: false,
        });
        const cuerpo = await respuesta.text().catch(() => "");
        const caido =
          respuesta.status() >= 500 ||
          /Worker exceeded resource limits|1102/i.test(cuerpo);
        if (caido) fallos.push(respuesta.status());
      }

      expect(
        fallos.length,
        `${fallos.length} de ${PETICIONES} peticiones a /login fallaron (${fallos.join(", ")}). ` +
          `Cloudflare 1102: el worker agota su límite de CPU. Los usuarios ven un error al entrar.`,
      ).toBeLessThanOrEqual(FALLOS_TOLERADOS);
    },
  );

  test(
    "la pantalla de empresas aguanta una navegación normal",
    anotar({
      modulo: "Despliegue",
      rol: "super admin",
      tipo: "feature",
      porque:
        "Ir y volver entre empresas es lo que hace cualquiera al revisar el día.",
    }),
    async ({ superAdmin }) => {
      const fallos: string[] = [];

      // Ir y volver, como haría alguien revisando varias empresas.
      for (let i = 0; i < 5; i++) {
        const respuesta = await superAdmin.goto("/empresas", {
          waitUntil: "domcontentloaded",
        });
        if ((respuesta?.status() ?? 0) >= 500)
          fallos.push(`/empresas ${respuesta?.status()}`);
      }

      expect(
        fallos,
        `navegación normal rota: ${fallos.join(", ")}`,
      ).toHaveLength(0);
    },
  );
});
