import { Info } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { SectionCard } from "@/components/section-card"
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

/**
 * El log vive en Postgres y solo tiene política de lectura, y solo para el
 * super admin: se escribe desde el servidor, nadie lo edita desde la app.
 */
export default async function AuditoriaPage() {
  const session = await requireSession()

  if (!session.isSuperAdmin) {
    return (
      <Alert>
        <Info />
        <AlertDescription>La auditoría es exclusiva del super admin.</AlertDescription>
      </Alert>
    )
  }

  const supabase = await createClient()
  const { data: entradas } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300)

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Quién hizo qué y cuándo: empresas, usuarios, asignaciones, módulos y objetivos."
      />

      <SectionCard>
        <div className="overflow-x-auto">
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
        </div>
      </SectionCard>
    </>
  )
}
