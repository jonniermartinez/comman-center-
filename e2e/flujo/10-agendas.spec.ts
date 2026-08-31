import { capacidadesDe } from "../soporte/matriz"
import { AGENDA } from "../soporte/registros"
import { test } from "../soporte/fixtures"
import { anotar } from "../soporte/anotaciones"
import { empresaPorSlug } from "../soporte/api"
import { HOY, marca } from "../soporte/datos"
import { EMPRESA_A } from "../soporte/entorno"
import { expect } from "../soporte/fixtures"
import {
  abrirDialogo,
  abrirDialogoDe,
  abrirModulo,
  elegirPrimera,
  guardar,
  rellenar,
} from "../soporte/formulario"

/** Agendas: la cita previa a la venta. */
test.describe("Agendas", () => {
  for (const caso of capacidadesDe(AGENDA)) {
    test(caso.titulo, caso.ficha, caso.prueba)
  }
})

test.describe("Agendas por la pantalla", () => {
  test(
    "registrar una agenda guarda la cita",
    anotar({
      modulo: "Agendas",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "La agenda es el paso previo a la venta. Si no se guarda, el comercial pierde la " +
        "cita y nadie se entera hasta que el cliente no aparece.",
    }),
    async ({ coordinador, apiSuperAdmin }) => {
      const empresa = await empresaPorSlug(apiSuperAdmin, EMPRESA_A)
      const cliente = marca("agenda")

      await abrirModulo(coordinador, EMPRESA_A, "agendas")
      await abrirDialogo(coordinador, /Nueva agenda/, /Nueva agenda/)

      await elegirPrimera(coordinador, "sede")
      await elegirPrimera(coordinador, "responsable")
      await rellenar(coordinador, {
        fecha: HOY,
        hora: "10:30",
        nombre: cliente,
        celular: "3009876543",
      })
      await guardar(coordinador)

      const { data: agenda } = await apiSuperAdmin
        .from("appointments")
        .select("id")
        .eq("company_id", empresa!.id)
        .gte("scheduled_at", `${HOY}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      expect(agenda, "la agenda no se guardó").toBeTruthy()
      await apiSuperAdmin.from("appointments").delete().eq("id", agenda!.id)
    },
  )
})
