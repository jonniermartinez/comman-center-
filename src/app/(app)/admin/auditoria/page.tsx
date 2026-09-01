import { Info } from "lucide-react"

import { RecordsScaffold } from "@/components/records-scaffold"
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
import { requireSession } from "@/lib/auth/session"
import { construirHref } from "@/lib/data/company"
import { createClient } from "@/lib/supabase/server"

const ACCION_LABELS: Record<string, string> = {
  create: "Creación",
  update: "Cambio",
  delete: "Eliminación",
  restore: "Restauración",
  archive: "Archivado",
  assign: "Asignación",
  purge: "Borrado definitivo",
  unassign: "Desasignación",
}

const ENTIDAD_LABELS: Record<string, string> = {
  companies: "Empresa",
  branches: "Sede",
  profiles: "Usuario",
  company_users: "Asignación",
  company_modules: "Módulos",
  company_financing_types: "Financiaciones",
  company_payment_methods: "Medios de recaudo",
  objectives: "Objetivos",
}

/** Resumen legible de lo que cambió, a partir del jsonb que guardó la acción. */
function detalle(after: unknown, before: unknown): string {
  const valores = (after ?? before) as Record<string, unknown> | null
  if (!valores || typeof valores !== "object") return "—"
  return Object.entries(valores)
    .map(([clave, valor]) => `${clave}: ${Array.isArray(valor) ? valor.join(", ") : String(valor)}`)
    .join(" · ")
}

/** Cuántos movimientos por página. */
const POR_PAGINA = 50

/**
 * El log vive en Postgres y solo tiene política de lectura, y solo para el
 * super admin: se escribe desde el servidor, nadie lo edita desde la app.
 */
export default async function AuditoriaPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const session = await requireSession()
  const sp = await searchParams

  if (!session.isSuperAdmin) {
    return (
      <Alert>
        <Info />
        <AlertDescription>La auditoría es exclusiva del super admin.</AlertDescription>
      </Alert>
    )
  }

  // El log crece sin techo —una corrida de pruebas deja cientos de líneas— así
  // que se pagina en vez de traer un tope arbitrario y fingir que eso es todo.
  const page = Math.max(0, Number(typeof sp.p === "string" ? sp.p : 0) || 0)

  const supabase = await createClient()
  const { data: entradas, count } = await supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * POR_PAGINA, page * POR_PAGINA + POR_PAGINA - 1)

  return (
    <RecordsScaffold
      title="Auditoría"
      description="Quién hizo qué y cuándo: empresas, usuarios, asignaciones, módulos y objetivos."
      total={count ?? 0}
      page={page}
      pageSize={POR_PAGINA}
      hrefPagina={(p) => construirHref("/admin/auditoria", {}, p)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Cuándo</TableHead>
            <TableHead className="w-40">Quién</TableHead>
            <TableHead className="w-28">Acción</TableHead>
            <TableHead className="w-32">Entidad</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(entradas ?? []).map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-xs tabular-nums text-muted-foreground">
                {new Date(entry.created_at).toLocaleString("es-CO", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell className="text-sm">{entry.actor_name ?? "Sistema"}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    entry.action === "delete" || entry.action === "purge"
                      ? "destructive"
                      : entry.action === "create"
                        ? "default"
                        : "secondary"
                  }
                  className="text-[10px]"
                >
                  {ACCION_LABELS[entry.action] ?? entry.action}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {ENTIDAD_LABELS[entry.entity] ?? entry.entity}
              </TableCell>
              <TableCell className="text-sm">{detalle(entry.after, entry.before)}</TableCell>
            </TableRow>
          ))}

          {(entradas ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                Todavía no hay movimientos registrados. Crea una empresa o un usuario y
                aparecerán acá.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </RecordsScaffold>
  )
}
