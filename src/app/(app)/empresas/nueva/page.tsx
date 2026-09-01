"use client"

import { ArrowLeft, ArrowRight, Check, Info, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { CityCombobox } from "@/components/city-combobox"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { slugify } from "@/lib/format"
import { createCompany } from "@/lib/data/companies-actions"
import { useDb, useIsSuperAdmin } from "@/lib/store/hooks"
import { MODULES, type ModuleCode } from "@/lib/store/types"
import { cn } from "@/lib/utils"

const PASOS = [
  { n: 1, title: "Datos", hint: "Nombre, NIT, ciudad y color" },
  { n: 2, title: "Sedes", hint: "Dónde opera la empresa" },
  { n: 3, title: "Módulos", hint: "Qué formularios va a usar" },
  { n: 4, title: "Comercial", hint: "Financiaciones y recaudo" },
]

const COLORES = ["#0f766e", "#7c3aed", "#b45309", "#1d4ed8", "#be123c", "#0f172a"]

type SedeDraft = { name: string; city: string; department: string }

export default function NuevaEmpresaPage() {
  const db = useDb()
  const isSuperAdmin = useIsSuperAdmin()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [creando, startCreacion] = useTransition()
  const [name, setName] = useState("")
  const [nit, setNit] = useState("")
  const [city, setCity] = useState("Buga")
  const [department, setDepartment] = useState("Valle del Cauca")
  const [crmLabel, setCrmLabel] = useState("")
  const [accent, setAccent] = useState(COLORES[0])
  const [modules, setModules] = useState<ModuleCode[]>(["ventas", "pagos", "actividad_diaria", "agendas", "caja"])
  const [financing, setFinancing] = useState<string[]>(db.financing_types.map((f) => f.code))
  const [payments, setPayments] = useState<string[]>(db.payment_methods.map((p) => p.code))
  const [sedes, setSedes] = useState<SedeDraft[]>([
    { name: "Sede principal", city: "Buga", department: "Valle del Cauca" },
  ])

  if (!isSuperAdmin) {
    return (
      <Alert>
        <Info />
        <AlertDescription>
          Solo el super admin puede crear empresas. Cambia de usuario en el menú de abajo a la
          izquierda para probarlo.
        </AlertDescription>
      </Alert>
    )
  }

  const nameError = !name.trim()
    ? "El nombre es obligatorio."
    : db.companies.some((c) => c.slug === slugify(name))
      ? "Ya existe una empresa con ese nombre."
      : null

  const sedesValidas = sedes.length > 0 && sedes.every((x) => x.name.trim().length > 1)

  const canAdvance =
    step === 1 ? !nameError : step === 2 ? sedesValidas : modules.length > 0

  function toggle<T>(list: T[], value: T, set: (next: T[]) => void) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  }

  /**
   * Crear la empresa.
   *
   * Va dentro de una transición para que el botón quede bloqueado mientras el
   * servidor responde: el alta no es transaccional y cada clic crea una empresa
   * nueva, así que sin ese bloqueo un doble clic deja duplicados.
   */
  function submit() {
    startCreacion(async () => {
      const resultado = await createCompany({
        name,
        nit,
        city,
        department,
        accent_color: accent,
        crm_label: crmLabel || name,
        modules,
        financing_codes: financing,
        payment_codes: payments,
        branches: sedes.map((x) => ({
          name: x.name.trim(),
          city: x.city.trim() || undefined,
          department: x.department.trim() || undefined,
        })),
      })
      // Sin slug no se creó nada: el error se muestra y la pantalla se queda
      // como está, con los datos escritos, para poder reintentar.
      if (!resultado.slug) {
        toast.error(resultado.error ?? "No se pudo crear la empresa.")
        return
      }
      // Con slug pero con error, la empresa quedó a medio configurar: se entra a
      // ella igual, que es donde se termina.
      if (!resultado.ok) {
        toast.warning(`${name} quedó incompleta`, {
          description: resultado.error ?? "Termina de configurarla desde su pantalla.",
        })
      } else {
        toast.success(`${name} creada`, {
          description: `${sedes.length} sede(s) y ${modules.length} módulo(s). Asigna el equipo desde la empresa.`,
        })
      }
      router.push(`/e/${resultado.slug}`)
    })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nueva empresa"
        description="Una empresa cliente con sus módulos y su configuración comercial."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/empresas">
              <ArrowLeft className="size-4" />
              Cancelar
            </Link>
          </Button>
        }
      />

      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PASOS.map((p) => {
          const done = step > p.n
          const active = step === p.n
          return (
            <li key={p.n} className="space-y-1.5">
              <div
                className={cn(
                  "h-1 w-full rounded-full",
                  done ? "bg-emerald-600" : active ? "bg-primary" : "bg-muted",
                )}
              />
              <div className="flex items-center gap-1.5">
                {done ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {p.n}
                  </span>
                )}
                <span
                  className={cn(
                    "truncate text-xs font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {p.title}
                </span>
              </div>
              <p className="hidden text-[11px] leading-tight text-muted-foreground sm:block">
                {p.hint}
              </p>
            </li>
          )
        })}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Paso {step} · {PASOS[step - 1].title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Nombre de la empresa *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ruta Segura"
                    aria-invalid={!!nameError && name.length > 0}
                  />
                  {name.length > 0 && nameError ? (
                    <p className="text-xs text-destructive">{nameError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      URL: <code className="font-mono">/e/{slugify(name) || "…"}</code>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nit">NIT</Label>
                  <Input id="nit" value={nit} onChange={(e) => setNit(e.target.value)} placeholder="901.234.567-1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <CityCombobox
                    id="city"
                    value={{ ciudad: city, departamento: department }}
                    onChange={(v) => {
                      setCity(v.ciudad)
                      setDepartment(v.departamento ?? "")
                    }}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="crm">Nombre del CRM que usa</Label>
                  <Input
                    id="crm"
                    value={crmLabel}
                    onChange={(e) => setCrmLabel(e.target.value)}
                    placeholder={name || "LV Unión"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Aparece como título en el módulo de Gestión Diaria, igual que
                    &ldquo;CRM - LV Unión&rdquo; en el Excel.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Color de acento</Label>
                <div className="flex gap-2">
                  {COLORES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccent(color)}
                      style={{ backgroundColor: color }}
                      className={cn(
                        "size-8 rounded-sm ring-offset-2 transition",
                        accent === color && "ring-2 ring-foreground",
                      )}
                      aria-label={`Color ${color}`}
                      aria-pressed={accent === color}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-muted-foreground">
                Una empresa opera en una o varias sedes y cada comercial pertenece a una. El
                dashboard de la empresa es la suma de sus sedes. La primera queda como principal.
              </p>

              <div className="space-y-3">
                {sedes.map((sede, i) => (
                  <div key={i} className="space-y-3 border p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`sede-${i}`} className="text-xs">
                          Nombre de la sede
                        </Label>
                        <Input
                          id={`sede-${i}`}
                          value={sede.name}
                          placeholder="Sede Tuluá"
                          onChange={(e) =>
                            setSedes((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                      {i === 0 ? (
                        <Badge variant="secondary" className="mt-6 shrink-0 text-[10px]">
                          Principal
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mt-6 shrink-0"
                          aria-label={`Quitar ${sede.name || `sede ${i + 1}`}`}
                          onClick={() =>
                            setSedes((prev) => prev.filter((_, j) => j !== i))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`sede-ciudad-${i}`} className="text-xs">
                        Municipio
                      </Label>
                      <CityCombobox
                        id={`sede-ciudad-${i}`}
                        value={{ ciudad: sede.city, departamento: sede.department }}
                        onChange={(v) =>
                          setSedes((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? { ...x, city: v.ciudad, department: v.departamento ?? "" }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSedes((prev) => [
                    ...prev,
                    { name: "", city: city, department: department },
                  ])
                }
              >
                <Plus className="size-4" />
                Agregar sede
              </Button>

              {!sedesValidas && (
                <p className="text-xs text-destructive">
                  Cada sede necesita un nombre de al menos 2 caracteres.
                </p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">
                Los módulos definen qué formularios existen y qué secciones aparecen en el
                dashboard de esta empresa.
              </p>
              <div className="space-y-2">
                {MODULES.map((m) => (
                  <label
                    key={m.code}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 border p-3 transition-colors",
                      modules.includes(m.code) ? "border-primary bg-accent/40" : "hover:bg-accent/20",
                    )}
                  >
                    <Checkbox
                      checked={modules.includes(m.code)}
                      onCheckedChange={() => toggle(modules, m.code, setModules)}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">{m.name}</span>
                      <span className="block text-xs text-muted-foreground">{m.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {modules.length === 0 && (
                <p className="text-xs text-destructive">Habilita al menos un módulo.</p>
              )}
            </>
          )}

          {step === 4 && (
            <>
              {!modules.includes("ventas") && (
                <Alert>
                  <Info />
                  <AlertDescription>
                    Esta empresa no tiene el módulo de Reporte de Ventas. Puedes dejar la
                    configuración por defecto y ajustarla si lo habilitas después.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Financiaciones activas</Label>
                  <p className="text-xs text-muted-foreground">
                    Definen las filas del formulario de ventas y de facturación.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {db.financing_types.map((f) => (
                    <label
                      key={f.code}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm transition-colors",
                        financing.includes(f.code) ? "border-primary bg-accent/40" : "hover:bg-accent/20",
                      )}
                    >
                      <Checkbox
                        checked={financing.includes(f.code)}
                        onCheckedChange={() => toggle(financing, f.code, setFinancing)}
                      />
                      {f.name}
                    </label>
                  ))}
                </div>
                {financing.length === 0 && (
                  <p className="text-xs text-destructive">Activa al menos una financiación.</p>
                )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <div>
                  <Label className="text-sm">Medios de recaudo</Label>
                  <p className="text-xs text-muted-foreground">
                    Definen las filas del bloque de recaudo del reporte diario.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {db.payment_methods.map((pm) => (
                    <label
                      key={pm.code}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm transition-colors",
                        payments.includes(pm.code) ? "border-primary bg-accent/40" : "hover:bg-accent/20",
                      )}
                    >
                      <Checkbox
                        checked={payments.includes(pm.code)}
                        onCheckedChange={() => toggle(payments, pm.code, setPayments)}
                      />
                      {pm.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4 text-sm">
                <p className="font-medium">Resumen</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>
                    Empresa: <span className="text-foreground">{name || "—"}</span>
                    {city ? ` · ${city}${department ? `, ${department}` : ""}` : ""}
                  </li>
                  <li>
                    Sedes:{" "}
                    <span className="text-foreground">
                      {sedes.map((x) => x.name || "sin nombre").join(", ")}
                    </span>
                  </li>
                  <li>
                    Módulos:{" "}
                    <span className="text-foreground">
                      {modules.map((m) => MODULES.find((x) => x.code === m)?.name).join(", ") || "—"}
                    </span>
                  </li>
                  <li>
                    Financiaciones: <span className="text-foreground">{financing.length}</span> ·
                    Medios de recaudo: <span className="text-foreground">{payments.length}</span>
                  </li>
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  El equipo se asigna después, desde Equipo dentro de la empresa.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          <ArrowLeft className="size-4" />
          Atrás
        </Button>

        {step < 4 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
            Siguiente
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={
              !!nameError || modules.length === 0 || financing.length === 0 || creando
            }
          >
            <Check className="size-4" />
            {creando ? "Creando…" : "Crear empresa"}
          </Button>
        )}
      </div>
    </div>
  )
}
