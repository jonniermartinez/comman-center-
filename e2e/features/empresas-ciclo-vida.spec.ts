import { anotar } from "../soporte/anotaciones";
import { borrarEmpresa, empresaPorSlug } from "../soporte/api";
import { nombreDePrueba } from "../soporte/guardarrail";
import { expect, test } from "../soporte/fixtures";
import { irA } from "../soporte/reintento";

/**
 * El ciclo completo de una empresa por la interfaz: crearla, verla, borrarla.
 *
 * La primera prueba es una regresión con nombre y apellido. El 31/08/2026
 * aparecieron siete empresas "test" idénticas creadas con 330 ms de diferencia:
 * el botón de crear no se bloqueaba mientras el servidor respondía y la Server
 * Action devolvía 500 después de haber escrito en la base, así que la pantalla
 * no confirmaba nada y se volvía a pulsar. Un doble clic no puede volver a
 * dejar dos empresas.
 */

test.describe("Alta de empresa", () => {
  test(
    "un doble clic crea una sola empresa",
    anotar({
      modulo: "Empresas",
      rol: "super admin",
      tipo: "regresión",
      porque:
        "Cada clic crea una empresa y el alta no es transaccional: sin bloqueo, un doble clic deja duplicados.",
      regresion:
        "El 31/08/2026 aparecieron siete empresas idénticas creadas con 330 ms de diferencia.",
    }),
    async ({ superAdmin, apiSuperAdmin }) => {
      const nombre = nombreDePrueba("doble-clic");
      const slug = nombre;

      await irA(superAdmin, "/empresas/nueva");
      await superAdmin.locator("#name").fill(nombre);

      // Los cinco pasos del asistente hasta el botón final.
      for (let paso = 1; paso < 5; paso++) {
        await superAdmin.getByRole("button", { name: "Siguiente" }).click();
      }

      const crear = superAdmin.getByRole("button", { name: /Crear empresa/ });
      await expect(crear).toBeEnabled();

      // Dos clics seguidos, como los daría alguien que no ve respuesta.
      await crear.click();
      await crear.click({ force: true, timeout: 2000 }).catch(() => {
        // Que el segundo clic no llegue es exactamente lo que se quiere: el botón
        // queda deshabilitado. Si llega, la comprobación de abajo lo caza igual.
      });

      await superAdmin.waitForURL(/\/e\//, { timeout: 30_000 });

      const { data: repetidas } = await apiSuperAdmin
        .from("companies")
        .select("slug")
        .like("slug", `${slug}%`);

      expect(
        repetidas ?? [],
        `un doble clic dejó ${repetidas?.length} empresas: ${(repetidas ?? []).map((e) => e.slug).join(", ")}`,
      ).toHaveLength(1);

      await borrarEmpresa(apiSuperAdmin, slug);
    },
  );

  test(
    "el botón dice Creando… mientras trabaja",
    anotar({
      modulo: "Empresas",
      rol: "super admin",
      tipo: "regresión",
      porque:
        "El estado de espera es lo que le dice a la persona que no vuelva a pulsar.",
      regresion:
        "Su ausencia fue la causa directa de las siete empresas duplicadas (31/08/2026).",
    }),
    async ({ superAdmin, apiSuperAdmin }) => {
      const nombre = nombreDePrueba("pendiente");

      await irA(superAdmin, "/empresas/nueva");
      await superAdmin.locator("#name").fill(nombre);
      for (let paso = 1; paso < 5; paso++) {
        await superAdmin.getByRole("button", { name: "Siguiente" }).click();
      }

      await superAdmin.getByRole("button", { name: /Crear empresa/ }).click();
      // El estado de espera tiene que existir: es lo que le dice a la persona que
      // no vuelva a pulsar.
      await expect(
        superAdmin.getByRole("button", { name: /Creando/ }),
      ).toBeVisible({
        timeout: 5_000,
      });

      await superAdmin.waitForURL(/\/e\//, { timeout: 30_000 });
      await borrarEmpresa(apiSuperAdmin, nombre);
    },
  );

  test(
    "no deja crear dos empresas con el mismo nombre",
    anotar({
      modulo: "Empresas",
      rol: "super admin",
      tipo: "feature",
      porque:
        "El nombre define la dirección de la empresa: dos iguales serían dos URLs indistinguibles.",
    }),
    async ({ superAdmin, apiSuperAdmin }) => {
      const nombre = nombreDePrueba("duplicada");
      await irA(superAdmin, "/empresas/nueva");
      await superAdmin.locator("#name").fill(nombre);
      for (let paso = 1; paso < 5; paso++) {
        await superAdmin.getByRole("button", { name: "Siguiente" }).click();
      }
      await superAdmin.getByRole("button", { name: /Crear empresa/ }).click();
      await superAdmin.waitForURL(/\/e\//, { timeout: 30_000 });

      // La segunda vez, el mismo nombre: el paso 1 tiene que protestar y no
      // dejar avanzar.
      await irA(superAdmin, "/empresas/nueva");
      await superAdmin.locator("#name").fill(nombre);
      await expect(superAdmin.locator("body")).toContainText(
        /Ya existe una empresa/i,
      );
      await expect(
        superAdmin.getByRole("button", { name: "Siguiente" }),
      ).toBeDisabled();

      await borrarEmpresa(apiSuperAdmin, nombre);
    },
  );
});

test.describe("Borrado definitivo", () => {
  test(
    "cuenta lo que se va a perder y exige el nombre exacto",
    anotar({
      modulo: "Empresas",
      rol: "super admin",
      tipo: "regresión",
      porque:
        "Borrar se lleva años de registros sin vuelta atrás; el conteo y el nombre exacto son la última red.",
      regresion:
        "El conteo se quedaba en 'Contando…' para siempre: la función de Postgres nombraba tablas del modelo viejo.",
    }),
    async ({ superAdmin, apiSuperAdmin }) => {
      const nombre = nombreDePrueba("borrar");
      await irA(superAdmin, "/empresas/nueva");
      await superAdmin.locator("#name").fill(nombre);
      for (let paso = 1; paso < 5; paso++) {
        await superAdmin.getByRole("button", { name: "Siguiente" }).click();
      }
      await superAdmin.getByRole("button", { name: /Crear empresa/ }).click();
      await superAdmin.waitForURL(/\/e\//, { timeout: 30_000 });

      await irA(superAdmin, "/empresas");
      const tarjeta = superAdmin
        .locator("div")
        .filter({ hasText: nombre })
        .last();
      await tarjeta
        .getByRole("button", { name: new RegExp(`Acciones de ${nombre}`) })
        .click();
      await superAdmin
        .getByRole("menuitem", { name: /Eliminar definitivamente/ })
        .click();

      // El conteo tiene que llegar. Antes se quedaba en "Contando…" para siempre
      // porque la función de Postgres nombraba tablas del modelo viejo.
      await expect(
        superAdmin.getByText("Contando lo que se va a borrar…"),
      ).toHaveCount(0, {
        timeout: 20_000,
      });
      await expect(superAdmin.locator("body")).toContainText("Sedes");

      const borrar = superAdmin.getByRole("button", {
        name: /Eliminar para siempre/,
      });
      await expect(
        borrar,
        "se pudo borrar sin escribir el nombre",
      ).toBeDisabled();

      await superAdmin.locator("#confirmar").fill("nombre equivocado");
      await expect(
        borrar,
        "se pudo borrar con el nombre equivocado",
      ).toBeDisabled();

      await superAdmin.locator("#confirmar").fill(nombre);
      await expect(borrar).toBeEnabled();
      await borrar.click();

      await expect
        .poll(async () => await empresaPorSlug(apiSuperAdmin, nombre), {
          timeout: 20_000,
        })
        .toBeNull();
    },
  );
});
