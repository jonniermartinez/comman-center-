"use client"

import { KeyRound, Link2Off, ListChecks, Plug, RefreshCw, Save, Users } from "lucide-react"
import { useCallback, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { CampoSelect, valorOpcional } from "@/components/captura/campos"
import { Combobox } from "@/components/combobox"
import { GuiaConexion, GuiaWebhook, type AvisoKommo } from "@/components/kommo/guias"
import { SincronizarKommo } from "@/components/kommo/sincronizar-kommo"
import { SectionCard, SectionCardHeader } from "@/components/section-card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  conectarKommo,
  desconectarKommo,
  guardarConfigKommo,
  leerEstructuraKommo,
} from "@/lib/data/kommo-actions"
import { sugerirUsuarios, type ConfigKommo, type EstructuraKommo } from "@/lib/kommo"
import { cn } from "@/lib/utils"

export interface IntegracionKommo {
  subdomain: string
  token_hint: string
  config: Partial<ConfigKommo>
  last_sync_at: string | null
  last_sync_count: number | null
  last_error: string | null
  webhook_ultimo_at: string | null
}

export function KommoIntegracion({
  companyId,
  isSuperAdmin,
  branches,
  staff,
  integracion,
  avisos,
  urlApp,
}: {
  companyId: string
  isSuperAdmin: boolean
  branches: { id: string; name: string; is_primary: boolean }[]
  staff: { id: string; full_name: string }[]
  integracion: IntegracionKommo | null
  avisos: AvisoKommo[]
  urlApp: string
}) {
  return (
    <div className="space-y-4">
      <GuiaConexion conectado={!!integracion} />
      <Conexion companyId={companyId} isSuperAdmin={isSuperAdmin} integracion={integracion} />
      {integracion && (
        <Configuracion
          // Al cambiar de cuenta, la configuración vieja no aplica: se vuelve a montar.
          key={integracion.subdomain}
          companyId={companyId}
          branches={branches}
          staff={staff}
          integracion={integracion}
        />
      )}
      <GuiaWebhook
        companyId={companyId}
        isSuperAdmin={isSuperAdmin}
        conectado={!!integracion}
        configurado={!!integracion?.config.modo}
        ultimoAviso={integracion?.webhook_ultimo_at ?? null}
        avisos={avisos}
        urlApp={urlApp}
      />
    </div>
  )
}

function Conexion({
  companyId,
  isSuperAdmin,
  integracion,
}: {
  companyId: string
  isSuperAdmin: boolean
  integracion: IntegracionKommo | null
}) {
  const [editando, setEditando] = useState(!integracion)
  const [subdominio, setSubdominio] = useState(integracion?.subdomain ?? "")
  const [token, setToken] = useState("")
  const [pendiente, startTransition] = useTransition()

  const formulario = isSuperAdmin && editando

  return (
    <SectionCard>
      <SectionCardHeader
        icon={Plug}
        title="Conexión"
        description={
          integracion ? `${integracion.subdomain}.kommo.com` : "Esta empresa todavía no tiene Kommo"
        }
      />

      {integracion && !formulario && (
        <div className="space-y-3 text-sm">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Token</dt>
              <dd className="font-mono">••••{integracion.token_hint}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Última sincronización</dt>
              <dd>
                {integracion.last_sync_at
                  ? `${new Date(integracion.last_sync_at).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })} · ${integracion.last_sync_count ?? 0} agendas`
                  : "Nunca"}
              </dd>
            </div>
          </dl>

          {integracion.last_error && (
            <Alert variant="destructive">
              <AlertDescription>Último intento: {integracion.last_error}</AlertDescription>
            </Alert>
          )}

          {isSuperAdmin && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setEditando(true)}>
                <KeyRound className="size-4" />
                Cambiar token
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <Link2Off className="size-4" />
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Desconectar Kommo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borra el token y la configuración. Las agendas que ya se trajeron se
                      conservan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        const r = await desconectarKommo(companyId)
                        if (!r.ok) {
                          toast.error(r.error)
                          return
                        }
                        toast.success("Kommo desconectado")
                        setSubdominio("")
                        setEditando(true)
                      }}
                    >
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      )}

      {!integracion && !isSuperAdmin && (
        <p className="text-sm text-muted-foreground">
          La conexión la hace el super admin con el token de la cuenta de Kommo de la empresa.
        </p>
      )}

      {formulario && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="kommo-sub">Subdominio</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="kommo-sub"
                  value={subdominio}
                  onChange={(e) => setSubdominio(e.target.value)}
                  placeholder="miempresa"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <span className="shrink-0 text-sm text-muted-foreground">.kommo.com</span>
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="kommo-token">Token de larga duración</Label>
              <Input
                id="kommo-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                placeholder={integracion ? "Pega el token nuevo" : "eyJ0eXAiOiJKV1Qi…"}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ¿Dónde se saca? Mira la guía de arriba, paso por paso.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {integracion && (
              <Button variant="outline" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            )}
            <Button
              disabled={pendiente || !subdominio.trim() || token.trim().length < 20}
              onClick={() =>
                startTransition(async () => {
                  const r = await conectarKommo({
                    company_id: companyId,
                    subdomain: subdominio,
                    token,
                  })
                  setToken("")
                  if (!r.ok) {
                    toast.error(r.error)
                    return
                  }
                  toast.success("Kommo conectado", { description: r.cuenta })
                  setEditando(false)
                })
              }
            >
              <Plug className="size-4" />
              {pendiente ? "Probando…" : integracion ? "Guardar y probar" : "Conectar"}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function Configuracion({
  companyId,
  branches,
  staff,
  integracion,
}: {
  companyId: string
  branches: { id: string; name: string; is_primary: boolean }[]
  staff: { id: string; full_name: string }[]
  integracion: IntegracionKommo
}) {
  const inicial = integracion.config
  const [estructura, setEstructura] = useState<EstructuraKommo | null>(null)
  const [errorLectura, setErrorLectura] = useState<string | null>(null)
  const [leyendo, startLectura] = useTransition()
  const [guardando, startGuardado] = useTransition()

  const [tareaId, setTareaId] = useState(inicial.tipo_tarea_id ? String(inicial.tipo_tarea_id) : "")
  const [branchId, setBranchId] = useState(inicial.branch_id ?? "")
  const [usuarios, setUsuarios] = useState<Record<string, string>>(inicial.usuarios ?? {})

  const leer = useCallback(() => {
    startLectura(async () => {
      const r = await leerEstructuraKommo(companyId)
      if (!r.ok || !r.estructura) {
        setErrorLectura(r.error ?? "No se pudo leer Kommo.")
        return
      }
      setErrorLectura(null)
      setEstructura(r.estructura)
      // Solo se sugiere para quien no tiene persona asignada todavía.
      const sugerencia = sugerirUsuarios(r.estructura.usuarios, staff)
      setUsuarios((actual) => ({ ...sugerencia, ...actual }))
    })
  }, [companyId, staff])

  useEffect(() => {
    leer()
  }, [leer])

  const configurado = !!inicial.modo

  return (
    <>
      <SectionCard>
        <SectionCardHeader
          icon={ListChecks}
          title="Qué tareas son agendas"
          description={estructura ? `Cuenta: ${estructura.cuenta}` : undefined}
          actions={
            <Button variant="ghost" size="sm" disabled={leyendo} onClick={leer}>
              <RefreshCw className={cn("size-4", leyendo && "animate-spin")} />
              <span className="sr-only sm:not-sr-only">{leyendo ? "Leyendo…" : "Releer"}</span>
            </Button>
          }
        />

        {errorLectura && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{errorLectura}</AlertDescription>
          </Alert>
        )}

        {!estructura && !errorLectura && (
          <p className="text-sm text-muted-foreground">Leyendo tipos de tarea y usuarios de Kommo…</p>
        )}

        {estructura && (
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelect
              id="kommo-tarea"
              label="Tipo de tarea"
              value={tareaId || "__vacio"}
              onChange={(v) => setTareaId(valorOpcional(v) ?? "")}
              vacio="Todas las tareas"
              options={estructura.tiposTarea.map((t) => ({ value: String(t.id), label: t.name }))}
            />
            <CampoSelect
              id="kommo-sede"
              label="Sede si el responsable no tiene una"
              value={branchId || "__vacio"}
              onChange={(v) => setBranchId(valorOpcional(v) ?? "")}
              vacio="La sede principal"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Una agenda es una tarea del calendario de Kommo. Si en Kommo usan un tipo para las citas
              (por ejemplo “Reunión”), elígelo; si no, cuentan todas.
            </p>
          </div>
        )}
      </SectionCard>

      {estructura && (
        <SectionCard>
          <SectionCardHeader
            icon={Users}
            title="Usuarios de Kommo"
            description="A qué persona del equipo corresponde cada uno"
          />
          <div className="divide-y">
            {estructura.usuarios.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-1 items-center gap-1.5 py-2 sm:grid-cols-[1fr_16rem] sm:gap-3"
              >
                <span className="min-w-0 truncate text-sm">{u.name}</span>
                <Combobox
                  value={usuarios[String(u.id)] ?? "__vacio"}
                  onChange={(v) =>
                    setUsuarios((actual) => {
                      const next = { ...actual }
                      const valor = valorOpcional(v)
                      if (valor) next[String(u.id)] = valor
                      else delete next[String(u.id)]
                      return next
                    })
                  }
                  vacio="Sin enlazar"
                  options={staff.map((s) => ({ value: s.id, label: s.full_name }))}
                  buscar="Buscar persona…"
                  size="sm"
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sin enlazar, la agenda queda sin responsable del equipo y no cuenta en sus indicadores.
          </p>
        </SectionCard>
      )}

      {estructura && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {configurado && <SincronizarKommo companyId={companyId} />}
          <Button
            disabled={guardando}
            onClick={() =>
              startGuardado(async () => {
                const r = await guardarConfigKommo(companyId, {
                  tipo_tarea_id: tareaId ? Number(tareaId) : null,
                  branch_id: branchId || null,
                  usuarios,
                })
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                toast.success("Configuración guardada", {
                  description: configurado ? undefined : "Sigue con la guía del webhook.",
                })
              })
            }
          >
            <Save className="size-4" />
            {guardando ? "Guardando…" : "Guardar configuración"}
          </Button>
        </div>
      )}
    </>
  )
}
