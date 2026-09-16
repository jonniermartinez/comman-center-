"use client"

import {
  AlertTriangle,
  BookOpen,
  CheckSquare,
  ChevronDown,
  Copy,
  RefreshCw,
  Webhook,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { generarWebhookKommo, instalarWebhookKommo } from "@/lib/data/kommo-actions"
import { esDireccionPublica } from "@/lib/kommo"
import { cn } from "@/lib/utils"

export interface AvisoKommo {
  id: number
  recibido_at: string
  entidad: string
  accion: string
  entity_id: number | null
  error: string | null
}

/** Un paso numerado con su lista de acciones. */
function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number
  titulo: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums">
        {numero}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5 pb-1">
        <p className="text-sm font-medium">{titulo}</p>
        <div className="space-y-1.5 text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  )
}

/** Lo que hay que tocar en Kommo, resaltado para buscarlo en pantalla. */
function Boton({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
      {children}
    </span>
  )
}

/** Tarjeta plegable: abierta mientras hace falta, cerrada cuando ya se hizo. */
function Plegable({
  icon,
  title,
  description,
  abierta,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  abierta: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(abierta)
  return (
    <SectionCard>
      <SectionCardHeader
        icon={icon}
        title={title}
        description={description}
        className={open ? undefined : "mb-0 sm:mb-0"}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Ocultar" : "Ver guía"}
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </Button>
        }
      />
      {open && children}
    </SectionCard>
  )
}

export function GuiaConexion({ conectado }: { conectado: boolean }) {
  return (
    <Plegable
      icon={BookOpen}
      title="Guía: sacar el token de Kommo"
      description="Se hace una sola vez por empresa"
      abierta={!conectado}
    >
      <ol className="space-y-4">
        <Paso numero={1} titulo="Entra a Kommo con un usuario administrador">
          <p>
            Abre la cuenta de Kommo de <strong>esta</strong> empresa. Tiene que ser un usuario
            administrador: los demás no ven la opción de crear integraciones.
          </p>
        </Paso>
        <Paso numero={2} titulo="Copia el subdominio">
          <p>
            Mira la barra de direcciones del navegador. Si dice{" "}
            <code className="font-mono text-foreground">https://atenas.kommo.com/leads/</code>, el
            subdominio es <code className="font-mono text-foreground">atenas</code>.
          </p>
        </Paso>
        <Paso numero={3} titulo="Crea una integración privada">
          <p>
            Menú de la izquierda → <Boton>Ajustes</Boton> → <Boton>Integraciones</Boton>.
          </p>
          <p>
            Arriba a la derecha → <Boton>+ Crear integración</Boton>.
          </p>
          <p>
            Nombre: <em>Command Center</em>. Descripción: lo que quieras. Deja vacía la URL de
            redirección. En permisos marca <Boton>Acceso a todo</Boton>. Pulsa{" "}
            <Boton>Guardar</Boton>.
          </p>
        </Paso>
        <Paso numero={4} titulo="Genera el token de larga duración">
          <p>
            Abre la integración que acabas de crear → pestaña <Boton>Llaves y alcances</Boton> →{" "}
            <Boton>Generar token de larga duración</Boton>.
          </p>
          <p>
            Como fecha de vencimiento elige la más lejana que deje (hasta 5 años). Cuando venza, las
            agendas dejan de llegar.
          </p>
          <p>
            Copia el token completo: es un texto largo que empieza por{" "}
            <code className="font-mono text-foreground">eyJ</code>. Kommo no lo vuelve a mostrar.
          </p>
        </Paso>
        <Paso numero={5} titulo="Pégalo aquí abajo y pulsa Conectar">
          <p>
            Debe salir <em>“Kommo conectado”</em> con el nombre de la cuenta. Si sale que Kommo
            rechazó el token, vuelve al paso 4 y cópialo otra vez, completo.
          </p>
        </Paso>
      </ol>
    </Plegable>
  )
}

const ACCIONES: Record<string, string> = {
  add: "añadida",
  update: "editada",
  delete: "borrada",
}

/** Lo que Kommo manda en cada aviso de tarea y para qué se usa. */
const CAMPOS: { campo: string; uso: string }[] = [
  { campo: "task[add][0][id]", uso: "Identifica la agenda. Si llega otra vez, se actualiza, no se duplica." },
  { campo: "complete_before", uso: "Fecha y hora de la cita (hora de Colombia)." },
  { campo: "task_type", uso: "Tipo de tarea. Se compara con el tipo elegido arriba." },
  { campo: "responsible_user_id", uso: "Usuario de Kommo → persona del equipo, según la tabla de arriba." },
  { campo: "element_id · element_type", uso: "Lead (2) o contacto (1) de la tarea. De ahí salen nombre y celular." },
  { campo: "text", uso: "Texto de la tarea → Observación." },
  { campo: "status", uso: "1 = completada → Resultado “Completada”." },
]

export function GuiaWebhook({
  companyId,
  isSuperAdmin,
  conectado,
  configurado,
  ultimoAviso,
  avisos,
  urlApp,
}: {
  companyId: string
  isSuperAdmin: boolean
  conectado: boolean
  configurado: boolean
  ultimoAviso: string | null
  avisos: AvisoKommo[]
  /** Dirección con la que se abrió la aplicación, para mostrar cómo queda la del webhook. */
  urlApp: string
}) {
  const router = useRouter()
  const [url, setUrl] = useState<string | null>(null)
  const [instalando, startInstalar] = useTransition()
  const [generando, startGenerar] = useTransition()
  const [comprobando, startComprobar] = useTransition()
  const publica = esDireccionPublica(urlApp)
  const listo = conectado && configurado

  const copiar = async (texto: string) => {
    await navigator.clipboard.writeText(texto)
    toast.success("Copiado")
  }

  return (
    <Plegable
      icon={Webhook}
      title="Guía: conectar el webhook"
      description={
        ultimoAviso
          ? `Funcionando · último aviso ${new Date(ultimoAviso).toLocaleString("es-CO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}`
          : "Para que las agendas lleguen solas desde Kommo"
      }
      abierta={!ultimoAviso}
    >
      <div className="mb-5 space-y-2 text-sm text-muted-foreground">
        <p>
          Cada vez que alguien crea o edita una tarea en el calendario de Kommo, Kommo le avisa a
          Command Center y la agenda aparece aquí sola. Solo se reciben tareas: leads, contactos y
          chats no se traen.
        </p>
        {!listo && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              {conectado
                ? "Antes, guarda arriba qué tareas son agendas."
                : "Antes, conecta Kommo con la guía del token."}
            </AlertDescription>
          </Alert>
        )}
        {!publica && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              Estás en <code className="font-mono">{urlApp}</code>, que es tu computador. Kommo no
              puede avisarle a esa dirección: el webhook se conecta desde la aplicación publicada
              (la que empieza por https).
            </AlertDescription>
          </Alert>
        )}
      </div>

      <h3 className="mb-3 text-sm font-medium">Opción A · Automático (recomendado)</h3>
      <ol className="mb-6 space-y-4">
        <Paso numero={1} titulo="Pulsa Instalar en Kommo">
          <p>
            Command Center crea la dirección, entra a Kommo con el token y deja el webhook puesto con
            los dos eventos de tareas. Si había uno viejo de Command Center, lo reemplaza.
          </p>
          {isSuperAdmin ? (
            <Button
              size="sm"
              disabled={!listo || !publica || instalando}
              onClick={() =>
                startInstalar(async () => {
                  const r = await instalarWebhookKommo(companyId)
                  if (!r.ok || !r.url) {
                    toast.error(r.error)
                    return
                  }
                  setUrl(r.url)
                  toast.success("Webhook instalado en Kommo")
                })
              }
            >
              <Webhook className="size-4" />
              {instalando ? "Instalando…" : "Instalar en Kommo"}
            </Button>
          ) : (
            <p>Lo hace el super admin.</p>
          )}
        </Paso>
        <Paso numero={2} titulo="Compruébalo">
          <p>
            En Kommo: <Boton>Ajustes</Boton> → <Boton>Integraciones</Boton> →{" "}
            <Boton>Web hooks</Boton>. Debe aparecer una dirección que termina en{" "}
            <code className="font-mono text-foreground">/api/kommo/webhook/…</code> con “Tarea
            añadida” y “Tarea editada”. Luego sigue con la prueba del paso 6 de abajo.
          </p>
        </Paso>
      </ol>

      <h3 className="mb-3 text-sm font-medium">Opción B · A mano en Kommo</h3>
      <ol className="space-y-5">
        <Paso numero={1} titulo="Genera la dirección de Command Center">
          <p>Tiene esta forma, con un código secreto al final que es único de esta empresa:</p>
          <code className="block overflow-x-auto rounded border bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
            {urlApp}/api/kommo/webhook/<span className="text-primary">código-secreto</span>
          </code>
          {isSuperAdmin ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!listo || generando}>
                  <Webhook className="size-4" />
                  {generando ? "Generando…" : url ? "Generar otra" : "Generar dirección"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Generar la dirección del webhook?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Si ya había una puesta en Kommo, deja de funcionar y hay que reemplazarla por la
                    nueva.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      startGenerar(async () => {
                        const r = await generarWebhookKommo(companyId)
                        if (!r.ok || !r.url) {
                          toast.error(r.error)
                          return
                        }
                        setUrl(r.url)
                      })
                    }
                  >
                    Generar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <p>La dirección la genera el super admin.</p>
          )}

          {url && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={url}
                  className="font-mono text-xs"
                  onFocus={(e) => e.target.select()}
                />
                <Button variant="outline" size="icon" onClick={() => copiar(url)}>
                  <Copy className="size-4" />
                  <span className="sr-only">Copiar</span>
                </Button>
              </div>
              <p className="text-xs">
                Cópiala ya: al salir de esta página no se vuelve a mostrar. Si la pierdes, genera
                otra.
              </p>
            </div>
          )}
        </Paso>

        <Paso numero={2} titulo="Abre los webhooks en Kommo">
          <p>
            Entra a Kommo con un usuario administrador. Menú de la izquierda →{" "}
            <Boton>Ajustes</Boton> → <Boton>Integraciones</Boton>.
          </p>
          <p>
            Arriba a la derecha, junto a “Crear integración”, pulsa <Boton>Web hooks</Boton>.
          </p>
          <p className="text-xs">
            Si no aparece, el plan de Kommo de la empresa no incluye webhooks: usa “Traer de Kommo”
            cada día.
          </p>
        </Paso>

        <Paso numero={3} titulo="Pega la dirección">
          <p>
            Pulsa <Boton>+ Añadir webhook</Boton>. En el campo <Boton>URL</Boton> pega la dirección
            del paso 1, completa, sin espacios.
          </p>
        </Paso>

        <Paso numero={4} titulo="Marca solo estos dos eventos">
          <ul className="space-y-1">
            {["Tarea añadida (Task added)", "Tarea editada (Task edited)"].map((e) => (
              <li key={e} className="flex items-center gap-2 text-foreground">
                <CheckSquare className="size-4 shrink-0 text-primary" />
                {e}
              </li>
            ))}
          </ul>
          <p>
            Deja todo lo demás sin marcar (leads, contactos, compañías, notas, chats): Command Center
            no lo usa.
          </p>
        </Paso>

        <Paso numero={5} titulo="Guarda en Kommo">
          <p>
            Pulsa <Boton>Guardar</Boton>. El webhook queda en la lista con la dirección y los dos
            eventos.
          </p>
        </Paso>

        <Paso numero={6} titulo="Haz una prueba">
          <p>
            En Kommo, crea una tarea{configurado ? " del tipo elegido arriba" : ""} en un lead de
            prueba, con fecha y hora. Espera unos segundos y pulsa:
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={comprobando}
            onClick={() => startComprobar(() => router.refresh())}
          >
            <RefreshCw className={cn("size-4", comprobando && "animate-spin")} />
            Comprobar
          </Button>
          <p>
            Tiene que aparecer abajo en “Últimos avisos” y la agenda en el módulo Agendas. Nombre y
            celular del cliente se completan solos en un par de minutos.
          </p>
        </Paso>

        <Paso numero={7} titulo="Trae lo que había antes">
          <p>
            El webhook avisa solo de lo que pase desde ahora. Para lo anterior usa{" "}
            <Boton>Traer de Kommo</Boton> con el rango de fechas. Se puede repetir sin duplicar.
          </p>
        </Paso>
      </ol>

      <div className="mt-6 space-y-2 border-t pt-4">
        <h3 className="text-sm font-medium">Qué manda Kommo en cada aviso</h3>
        <p className="text-sm text-muted-foreground">
          Kommo hace un <code className="font-mono text-foreground">POST</code> a la dirección, en
          formato <code className="font-mono text-foreground">application/x-www-form-urlencoded</code>
          . No hay que configurar parámetros ni cabeceras en Kommo: el código secreto de la dirección
          es lo que identifica a la empresa.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {CAMPOS.map((c) => (
                <tr key={c.campo}>
                  <td className="py-1.5 pr-4 align-top font-mono text-xs whitespace-nowrap">{c.campo}</td>
                  <td className="py-1.5 text-muted-foreground">{c.uso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 space-y-2 border-t pt-4">
        <h3 className="text-sm font-medium">Últimos avisos</h3>
        {avisos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no ha llegado ninguno.</p>
        ) : (
          <ul className="divide-y">
            {avisos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="tabular-nums text-muted-foreground">
                  {new Date(a.recibido_at).toLocaleString("es-CO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span>
                  {a.entidad === "task" ? "Tarea" : a.entidad} {a.entity_id ? `#${a.entity_id}` : ""}{" "}
                  {ACCIONES[a.accion] ?? a.accion}
                </span>
                {a.error && (
                  <Badge variant="destructive" className="text-[10px] font-normal">
                    {a.error}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 space-y-2 border-t pt-4">
        <h3 className="text-sm font-medium">Si algo no funciona</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">“Instalar en Kommo” da error de permisos:</strong> el
            token no es de un administrador de la cuenta. Genera uno nuevo con un administrador y
            usa “Cambiar token”, o hazlo a mano (opción B).
          </li>
          <li>
            <strong className="text-foreground">No llega ningún aviso:</strong> en Kommo tiene que
            estar la última dirección generada (generar otra invalida la anterior), completa.
          </li>
          <li>
            <strong className="text-foreground">Llega el aviso pero no aparece la agenda:</strong> la
            tarea no es del tipo elegido arriba, o no tiene fecha.
          </li>
          <li>
            <strong className="text-foreground">Dejó de llegar después de funcionar:</strong> Kommo
            apaga un webhook que falla muchas veces seguidas. Vuelve a pulsar “Instalar en Kommo” y
            recupera lo perdido con “Traer de Kommo”.
          </li>
          <li>
            <strong className="text-foreground">Sale sin celular:</strong> se completa cada dos
            minutos; si sigue vacío, el contacto no tiene teléfono en Kommo.
          </li>
        </ul>
      </div>
    </Plegable>
  )
}
