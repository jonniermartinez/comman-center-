import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { ProductoAcciones } from "@/components/productos/producto-acciones"
import { ProductoDialog } from "@/components/productos/producto-dialog"
import { SectionCard } from "@/components/section-card"
import { StatStrip } from "@/components/stat-strip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCompanyContext } from "@/lib/data/company"
import { listCompanyProducts } from "@/lib/data/products"
import { formatCOP } from "@/lib/format"

/**
 * Productos: la lista de precios de la empresa.
 *
 * Es de cada empresa y no un catálogo común, porque el mismo curso A2 no vale
 * lo mismo en Tuluá que en Cali. De acá sale el precio que el comercial ve al
 * registrar una venta, y los bonos son la única forma autorizada de bajarlo.
 */
export default async function ProductosPage({ params }: PageProps<"/e/[slug]/productos">) {
  const { slug } = await params
  const company = await getCompanyContext(slug)
  if (!company) notFound()

  if (!company.canManage) {
    return (
      <Alert>
        <AlertDescription>
          La lista de productos de {company.name} la administra un coordinador o el super admin.
        </AlertDescription>
      </Alert>
    )
  }

  const productos = await listCompanyProducts(company.id)
  const activos = productos.filter((p) => p.active)
  const conBonos = activos.filter((p) => p.bonos.length > 0).length

  return (
    <>
      <PageHeader
        title="Productos"
        description={`Lo que vende ${company.name}, con su precio y los bonos que autoriza. El comercial elige de acá: el valor de una venta no se digita a mano.`}
        actions={<ProductoDialog companyId={company.id} />}
      />

      <StatStrip
        className="mb-6"
        items={[
          { label: "Productos activos", value: activos.length, unit: "cantidad" },
          { label: "Con bonos autorizados", value: conBonos, unit: "cantidad" },
          {
            label: "Precio más alto",
            value: activos.reduce((max, p) => Math.max(max, p.price), 0),
            unit: "moneda",
          },
        ]}
      />

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="w-32 text-right">Precio</TableHead>
              <TableHead>Bonos autorizados</TableHead>
              <TableHead className="w-24 text-right">Ventas</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.map((p) => (
              <TableRow key={p.id} className={p.active ? undefined : "opacity-55"}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.is_renovacion && (
                      <Badge variant="secondary" className="text-[10px]">
                        Renovación
                      </Badge>
                    )}
                    {!p.active && (
                      <Badge variant="outline" className="text-[10px]">
                        Archivado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCOP(p.price)}
                </TableCell>
                <TableCell>
                  {p.bonos.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sin bonos</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {p.bonos.map((b) => (
                        <Badge key={b.id} variant="outline" className="text-[10px] font-normal">
                          {b.name} · −{formatCOP(b.amount)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {p.ventas}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end">
                    <ProductoDialog companyId={company.id} producto={p} />
                    <ProductoAcciones producto={p} />
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {productos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Todavía no hay productos. Mientras la lista esté vacía, el valor de cada venta se
                  digita a mano.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>
    </>
  )
}
