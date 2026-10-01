import type { NextRequest } from "next/server"

import { getCompanyContext, nombreDe } from "@/lib/data/company"
import { descargaXlsx, encabezadoDe } from "@/lib/data/exportar"
import { allPayments, leerFiltros } from "@/lib/data/records"

/** Los pagos del filtro, en Excel: todos los que alcanza, no solo una página. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const company = await getCompanyContext(slug)
  if (!company || !company.modules.includes("pagos")) {
    return new Response("No encontrado", { status: 404 })
  }

  const filtros = leerFiltros(Object.fromEntries(req.nextUrl.searchParams))
  const { rows, truncado } = await allPayments(company.id, filtros)
  const sede = (id: string) => company.branches.find((b) => b.id === id)?.name ?? ""

  return descargaXlsx(
    {
      nombre: "Pagos",
      encabezado: encabezadoDe("Pagos", company.name, filtros, {
        filas: rows.length,
        truncado,
        otros: [filtros.branchId ? `Sede: ${sede(filtros.branchId)}` : null],
      }),
      columnas: [
        { titulo: "Fecha", ancho: 12 },
        { titulo: "Fecha aproximada", ancho: 16 },
        { titulo: "Sede", ancho: 18 },
        { titulo: "Titular", ancho: 34 },
        { titulo: "Documento", ancho: 14 },
        { titulo: "Referencia del crédito", ancho: 26 },
        { titulo: "Medio de pago", ancho: 18 },
        { titulo: "Recibo", ancho: 16 },
        { titulo: "Valor", ancho: 14 },
        { titulo: "Con venta", ancho: 10 },
        { titulo: "Observación", ancho: 40 },
      ],
      filas: rows.map((p) => [
        { fecha: p.report_date },
        p.date_estimated ? "Sí" : "",
        sede(p.branch_id),
        p.titular_nombre,
        p.titular_id,
        p.ref_credito,
        p.method_code ? nombreDe(company.mediosPago, p.method_code) : "",
        p.recibo,
        { pesos: Number(p.amount) },
        p.sale_id ? "Sí" : "No",
        p.observacion,
      ]),
    },
    slug,
    filtros,
  )
}
