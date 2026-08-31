import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import {
  asignarAEmpresa,
  clienteDe,
  crearEmpresa,
  empresaPorSlug,
  perfilPorEmail,
  vincularStaff,
} from "./api";
import { BASE_URL, CUENTAS, EMPRESA_A, EMPRESA_B, type Rol } from "./entorno";
import { irA } from "./reintento";

export const CARPETA_SESIONES = path.join(".auth");

export function rutaSesion(rol: Rol) {
  return path.join(CARPETA_SESIONES, `${rol}.json`);
}

/**
 * Deja el banco de pruebas en su sitio antes de que corra nada.
 *
 * Es idempotente: si ya existe, no lo vuelve a crear. Así una corrida
 * interrumpida no deja el entorno a medias ni obliga a limpiar a mano.
 *
 * El montaje se hace con la sesión del super admin de pruebas y las mismas
 * políticas que la aplicación. Si RLS se rompiera, esto falla antes que
 * ninguna prueba, y falla diciendo qué política dejó de funcionar.
 */
async function montarDatos() {
  const admin = await clienteDe("superAdmin");

  await crearEmpresa(admin, EMPRESA_A);
  await crearEmpresa(admin, EMPRESA_B);

  // El coordinador y el asesor A viven en la empresa A; el asesor B, en la B.
  // Esa asimetría es la que permite probar el aislamiento entre empresas.
  await asignarAEmpresa(
    admin,
    CUENTAS.coordinador.email,
    EMPRESA_A,
    "coordinador",
  );
  await asignarAEmpresa(admin, CUENTAS.asesorA.email, EMPRESA_A, "asesor");
  await asignarAEmpresa(admin, CUENTAS.asesorB.email, EMPRESA_B, "asesor");

  // Sin persona enlazada, un asesor no puede registrar nada a su nombre.
  await vincularStaff(admin, CUENTAS.asesorA.email, EMPRESA_A);
  await vincularStaff(admin, CUENTAS.asesorB.email, EMPRESA_B);

  // La cuenta suspendida se deja suspendida de verdad: perfil inactivo (que es
  // lo que mira RLS) y login bloqueado en Auth. Su prueba es que no puede
  // entrar, así que el estado tiene que ser real, no simulado.
  const suspendido = await perfilPorEmail(admin, CUENTAS.suspendido.email);
  if (suspendido) {
    await admin
      .from("profiles")
      .update({ status: "inactivo" })
      .eq("id", suspendido.id);
    await admin.rpc("admin_ban_user", {
      target_user: suspendido.id,
      bloquear: true,
    });
  }

  const a = await empresaPorSlug(admin, EMPRESA_A);
  const b = await empresaPorSlug(admin, EMPRESA_B);
  if (!a || !b)
    throw new Error("El montaje no dejó las dos empresas de prueba");

  return { a, b };
}

/**
 * Guarda una sesión de navegador por rol.
 *
 * Se entra por el formulario de verdad, no inyectando cookies: si el login se
 * rompe, todas las pruebas se caen de golpe y con un mensaje claro, que es
 * mejor que verlas fallar una a una por motivos aparentemente distintos.
 */
async function guardarSesiones() {
  fs.mkdirSync(CARPETA_SESIONES, { recursive: true });
  const navegador = await chromium.launch();

  // El suspendido no tiene sesión guardada: su prueba es justamente que no puede
  // entrar, y eso se comprueba en vivo.
  const roles: Rol[] = ["superAdmin", "coordinador", "asesorA", "asesorB"];

  for (const rol of roles) {
    const contexto = await navegador.newContext({ baseURL: BASE_URL });
    const pagina = await contexto.newPage();
    const cuenta = CUENTAS[rol];

    // El worker de Cloudflare puede tardar en despertar y la primera carga
    // llegar en frío. Se espera al formulario explícitamente en vez de dar por
    // hecho que ya está: si no, el fallo aparece como "no encuentro #email",
    // que no dice nada de lo que pasó.
    // Un fallo aquí tumba la corrida entera. Se reintenta el login completo
    // —no solo la navegación— porque el 1102 del worker cae también al enviar
    // el formulario, y cuando se agotan los intentos el error dice qué rol y
    // qué había en pantalla: "no encuentro #email" a secas no explica nada.
    let ultimoFallo = "";
    let dentro = false;

    for (let intento = 1; intento <= 3 && !dentro; intento++) {
      try {
        await irA(pagina, "/login");
        await pagina
          .locator("#email")
          .waitFor({ state: "visible", timeout: 45_000 });

        await pagina.locator("#email").fill(cuenta.email);
        await pagina.locator("#password").fill(cuenta.password);
        await pagina.getByRole("button", { name: "Entrar" }).click();

        await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), {
          timeout: 45_000,
        });
        dentro = true;
      } catch (fallo) {
        const enPantalla = await pagina
          .locator("body")
          .innerText()
          .catch(() => "(sin cuerpo)");
        ultimoFallo =
          `URL: ${pagina.url()}\n` +
          `Pantalla: ${enPantalla.slice(0, 300)}\n` +
          `Causa: ${fallo instanceof Error ? fallo.message : fallo}`;
        if (intento < 3) await pagina.waitForTimeout(intento * 3000);
      }
    }

    if (!dentro) {
      throw new Error(
        `Montaje: no se pudo abrir sesión como ${rol} (${cuenta.email}) en 3 intentos.\n${ultimoFallo}`,
      );
    }

    await contexto.storageState({ path: rutaSesion(rol) });
    await contexto.close();
  }

  await navegador.close();
}

export default async function montaje(_config: FullConfig) {
  await montarDatos();
  await guardarSesiones();
}
