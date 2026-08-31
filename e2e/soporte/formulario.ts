import { expect, type Locator, type Page } from "@playwright/test";

import { irA } from "./reintento";

/**
 * Gestos que se repiten en todos los formularios de captura.
 *
 * Están aquí y no copiados en cada prueba porque los cinco formularios usan los
 * mismos componentes: si el desplegable de shadcn cambia de estructura, se
 * arregla en un sitio y no en treinta.
 */

/** Abre el módulo de una empresa y espera a que la pantalla esté servida. */
export async function abrirModulo(
  pagina: Page,
  empresa: string,
  modulo: string,
) {
  await irA(pagina, `/e/${empresa}/${modulo}`);
  await expect(pagina.locator("body")).not.toContainText(
    "Módulo no habilitado",
  );
}

/**
 * Abre un diálogo por el texto de su botón y espera a su título.
 *
 * Reintenta el clic, y no es paranoia: el botón se pinta en el HTML del
 * servidor pero no hace nada hasta que React hidrata. Un clic que llega en ese
 * hueco se pierde sin dejar rastro —no falla, simplemente no pasa nada— y la
 * prueba muere después esperando un diálogo que nadie abrió. En este
 * despliegue, que va justo de CPU, el hueco es de segundos.
 *
 * Esperar al título además evita empezar a rellenar antes de que el diálogo
 * haya montado, con el primer `fill` cayendo en el vacío.
 */
export async function abrirDialogo(
  pagina: Page,
  boton: RegExp,
  titulo: RegExp,
) {
  await abrirDialogoDe(
    pagina,
    pagina.getByRole("button", { name: boton }).first(),
    titulo,
    boton,
  );
}

/**
 * Igual, pero con el disparador ya localizado.
 *
 * Lo usan los lápices de edición, cuyo botón se identifica por el registro
 * concreto ("Editar la venta de Fulano") y no por un texto fijo.
 */
export async function abrirDialogoDe(
  pagina: Page,
  disparador: Locator,
  titulo: RegExp,
  descripcion: RegExp | string = "el disparador",
) {
  await expect(
    disparador,
    `no hay botón ${descripcion} en la pantalla`,
  ).toBeVisible({
    timeout: 30_000,
  });

  const dialogo = pagina.getByRole("dialog");

  for (let intento = 1; intento <= 4; intento++) {
    await disparador.click();
    try {
      await expect(dialogo.getByText(titulo).first()).toBeVisible({
        timeout: 5_000,
      });
      return;
    } catch {
      if (intento === 4) {
        throw new Error(
          `El diálogo ${titulo} no abrió tras 4 clics en ${descripcion}. ` +
            `O el botón no está enganchado, o el título cambió.`,
        );
      }
      await pagina.waitForTimeout(1500);
    }
  }
}

/**
 * Elige una opción de un desplegable de shadcn/Radix.
 *
 * No es un `<select>` nativo: es un botón que abre una lista en un portal, así
 * que `selectOption` no sirve. Hay que pulsar y luego elegir la opción.
 */
export async function elegir(
  pagina: Page,
  campo: string,
  opcion: RegExp | string,
) {
  await pagina.locator(`#${campo}`).click();
  await pagina.getByRole("option", { name: opcion }).first().click();
}

/** La primera opción disponible de un desplegable, sea cual sea. */
export async function elegirPrimera(pagina: Page, campo: string) {
  await pagina.locator(`#${campo}`).click();
  const opciones = pagina.getByRole("option");
  await expect(opciones.first()).toBeVisible();
  const texto = await opciones.first().innerText();
  await opciones.first().click();
  return texto.trim();
}

/** Rellena varios campos de texto de una vez. */
export async function rellenar(pagina: Page, campos: Record<string, string>) {
  for (const [id, valor] of Object.entries(campos)) {
    await pagina.locator(`#${id}`).fill(valor);
  }
}

/**
 * Envía el diálogo y espera a que se cierre.
 *
 * Que el diálogo se cierre es la señal de que el servidor aceptó. Si se queda
 * abierto, algo falló, y la prueba lo dice aquí en vez de más adelante con un
 * mensaje que no tiene que ver.
 */
export async function guardar(
  pagina: Page,
  boton: RegExp = /Guardar|Registrar|Crear/,
) {
  await pagina
    .getByRole("dialog")
    .getByRole("button", { name: boton })
    .last()
    .click();
  await expect(
    pagina.getByRole("dialog"),
    "el diálogo no se cerró: el guardado falló",
  ).toBeHidden({ timeout: 30_000 });
}
