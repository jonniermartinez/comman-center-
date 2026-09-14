import { capacidadesDe } from "../soporte/matriz"
import { JORNADA } from "../soporte/registros"
import { test } from "../soporte/fixtures"
import { anotar } from "../soporte/anotaciones"
import { empresaPorSlug } from "../soporte/api"
import { HOY, marca } from "../soporte/datos"
import { expect } from "../soporte/fixtures"
import {
  abrirDialogo,
  abrirDialogoDe,
  abrirModulo,
  elegirPrimera,
  guardar,
  rellenar,
} from "../soporte/formulario"

/** Gestión diaria: el parte del día de cada persona. */
test.describe("Gestión diaria", () => {
  for (const caso of capacidadesDe(JORNADA)) {
    test(caso.titulo, caso.ficha, caso.prueba)
  }
})

test.describe("Gestión diaria por la pantalla", () => {
  test(
    "registrar la jornada guarda el conteo del día",
    anotar({
      modulo: "Gestión diaria",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "Es la hoja que el equipo llena a diario y de la que salen los ratios de " +
        "contactabilidad. Tiene una veintena de campos numéricos: si uno se descoloca, " +
        "los ratios salen mal y nadie lo nota mirando la pantalla.",
    }),
    async ({ coordinador, apiSuperAdmin, mundo }) => {
      const empresa = await Promise.resolve({ id: mundo.empresaA.companyId })

      // Una jornada por persona y día: si ya hay una de hoy, se quita antes.
      await apiSuperAdmin
        .from("daily_activity")
        .delete()
        .eq("company_id", empresa!.id)
        .eq("report_date", HOY)

      await abrirModulo(coordinador, mundo.empresaA.slug, "gestion-diaria")
      await abrirDialogo(coordinador, /Registrar jornada/, /Registrar jornada/)

      // En la jornada el comercial se elige en "persona", no en "responsable"
      // como en ventas y pagos: la prueba buscaba un campo que no existe.
      await elegirPrimera(coordinador, "sede")
      await elegirPrimera(coordinador, "persona")
      await coordinador.locator("#fecha").fill(HOY)
      await rellenar(coordinador, {
        "ll-efec": "2",
        "ll-seg": "38",
        "ll-agen": "12",
        "at-venta": "3",
      })
      await guardar(coordinador)

      const { data: jornada } = await apiSuperAdmin
        .from("daily_activity")
        .select("*")
        .eq("company_id", empresa!.id)
        .eq("report_date", HOY)
        .maybeSingle()

      expect(jornada, "la jornada no se guardó").toBeTruthy()

      await apiSuperAdmin
        .from("daily_activity")
        .delete()
        .eq("company_id", empresa!.id)
        .eq("report_date", HOY)
    },
  )
})
