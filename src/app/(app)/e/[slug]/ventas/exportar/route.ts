import type { NextRequest } from "next/server"

import { getCompanyContext, nombreDe } from "@/lib/data/company"
import { descargaXlsx, encabezadoDe } from "@/lib/data/exportar"
import { allSales, leerFiltros } from "@/lib/data/records"

/**
 * Las ventas del filtro, en Excel: las mismas que muestra el listado con ese
 * rango, esa sede, ese responsable y esa búsqueda, pero todas y no una página.
 * Lo que puede ver cada quien lo sigue decidiendo la base (RLS), igual que en
 * la pantalla.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const company = await getCompanyContext(slug)
  if (!company || !company.modules.includes("ventas")) {
    return new Response("No encontrado", { status: 404 })
  }

  const filtros = leerFiltros(Object.fromEntries(req.nextUrl.searchParams))
  const { rows, truncado } = await allSales(company.id, filtros)

  const sede = (id: string) => company.branches.find((b) => b.id === id)?.name ?? ""
  const catalogo = (lista: { code: string; name: string }[], code: string | null) =>
    code ? nombreDe(lista, code) : ""
  const producto = (id: string | null, code: string | null) =>
    (id ? company.productosEmpresa.find((p) => p.id === id)?.name : null) ??
    catalogo(company.productos, code)

  return descargaXlsx(
    {
      nombre: "Ventas",
      encabezado: encabezadoDe("Ventas", company.name, filtros, {
        filas: rows.length,
        truncado,
        otros: [
          filtros.branchId ? `Sede: ${sede(filtros.branchId)}` : null,
          filtros.staffId
            ? `Responsable: ${company.staff.find((s) => s.id === filtros.staffId)?.full_name ?? ""}`
            : null,
        ],
      }),
      columnas: [
        { titulo: "Fecha", ancho: 12 },
        { titulo: "Sede", ancho: 18 },
        { titulo: "Responsable", ancho: 24 },
        { titulo: "Tipo de venta", ancho: 14 },
        { titulo: "Canal", ancho: 14 },
        { titulo: "Titular de la licencia", ancho: 34 },
        { titulo: "Documento", ancho: 14 },
        { titulo: "Celular", ancho: 14 },
        { titulo: "Titular del crédito", ancho: 34 },
        { titulo: "Documento crédito", ancho: 16 },
        { titulo: "Producto", ancho: 14 },
        { titulo: "Licencias", ancho: 10 },
        { titulo: "Financiación", ancho: 16 },
        { titulo: "Valor de lista", ancho: 14 },
        { titulo: "Bonos", ancho: 12 },
        { titulo: "Adiciones", ancho: 12 },
        { titulo: "Valor final", ancho: 14 },
        { titulo: "Recaudo", ancho: 14 },
        { titulo: "Saldo", ancho: 14 },
        { titulo: "Estado", ancho: 16 },
        { titulo: "Escuela", ancho: 18 },
        { titulo: "Tráfico", ancho: 14 },
        { titulo: "Categoría del anuncio", ancho: 20 },
        { titulo: "Referencia del crédito", ancho: 22 },
        { titulo: "Observación", ancho: 40 },
      ],
      filas: rows.map((v) => [
        { fecha: v.report_date },
        sede(v.branch_id),
        v.responsable_nombre,
        catalogo(company.tiposVenta, v.sale_type_code),
        catalogo(company.canales, v.channel_code),
        v.licencia_nombre,
        v.licencia_id,
        v.licencia_celular,
        v.credito_nombre,
        v.credito_id,
        producto(v.company_product_id, v.product_code),
        Number(v.cantidad_final),
        catalogo(company.financiaciones, v.financing_code),
        { pesos: Number(v.valor_inicial) },
        { pesos: Number(v.descuento) },
        { pesos: Number(v.adicion) },
        { pesos: Number(v.valor_final) },
        { pesos: Number(v.recaudo) },
        { pesos: Number(v.saldo) },
        catalogo(company.estados, v.state_code),
        catalogo(company.escuelas, v.school_code),
        catalogo(company.traficos, v.traffic_code),
        catalogo(company.categorias, v.ad_category_code),
        v.ref_credito,
        v.observacion,
      ]),
    },
    slug,
    filtros,
  )
}
