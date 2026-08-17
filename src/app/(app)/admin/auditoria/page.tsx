"use client"

import { Info } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/section-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDb, useIsSuperAdmin } from "@/lib/store/hooks"

const ACCION_LABELS: Record<string, string> = {
  create: "Creación",
  update: "Cambio",
  delete: "Eliminación",
  restore: "Restauración",
  archive: "Archivado",
  assign: "Asignación",
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

export default function AuditoriaPage() {
  const db = useDb()
  const isSuperAdmin = useIsSuperAdmin()

  if (!isSuperAdmin) {
    return (
      <Alert>
        <Info />
        <AlertDescription>La auditoría es exclusiva del super admin.</AlertDescription>
      </Alert>
    )
  }

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
              {db.audit_log.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Date(entry.created_at).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-sm">{entry.actor_name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.action === "delete"
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
                  <TableCell className="text-sm">{entry.detail}</TableCell>
                </TableRow>
              ))}

              {db.audit_log.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no hay movimientos registrados. Crea una empresa, un usuario o cambia un
                    objetivo y aparecerán acá.
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
