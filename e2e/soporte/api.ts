import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../src/lib/supabase/database.types"
import { CUENTAS, SUPABASE_KEY, SUPABASE_URL, type Cuenta, type Rol } from "./entorno"
import { esDePrueba, exigirDePrueba } from "./guardarrail"

export type Cliente = SupabaseClient<Database>

/**
 * Acceso directo a la base con la sesión de un rol.
 *
 * Existe porque la interfaz no es la defensa: que un asesor no vea un botón no
 * demuestra nada. Lo que hay que demostrar es que **la base** le niega el dato
 * aunque pregunte por fuera de la aplicación, que es exactamente lo que hace
 * cualquiera con las herramientas del navegador abiertas. Estas pruebas
 * preguntan sin pasar por la interfaz.
 *
 * Siempre con la clave publicable, nunca con service_role: es la misma llave
 * que lleva el navegador, así que lo que aquí se ve es lo que un usuario podría
 * ver de verdad.
 */
export function clienteAnonimo(): Cliente {
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Sesiones ya abiertas, una por rol y por proceso.
 *
 * Sin esto cada prueba volvía a autenticarse y una corrida completa disparaba
 * decenas de logins en menos de un minuto: GoTrue limita por IP y empezaba a
 * rechazarlos, con lo que fallaban pruebas por el entorno y no por el código.
 * Una sesión por rol es además más fiel a la realidad: una persona entra una
 * vez y navega.
 */
const sesiones = new Map<string, Promise<Cliente>>()

async function abrirSesion(datos: Cuenta): Promise<Cliente> {
  const cliente = clienteAnonimo()
  let ultimoError = ""

  // Reintento con espera: si justo se topó con el límite de Auth, esperar es
  // la respuesta correcta, no fallar la prueba.
  for (let intento = 1; intento <= 3; intento++) {
    const { error } = await cliente.auth.signInWithPassword({
      email: datos.email,
      password: datos.password,
    })
    if (!error) return cliente
    ultimoError = error.message
    if (intento < 3) await new Promise((r) => setTimeout(r, intento * 2000))
  }

  throw new Error(`No se pudo iniciar sesión como ${datos.email}: ${ultimoError}`)
}

export function clienteDe(cuenta: Cuenta | Rol): Promise<Cliente> {
  const datos = typeof cuenta === "string" ? CUENTAS[cuenta] : cuenta
  const cacheada = sesiones.get(datos.email)
  if (cacheada) return cacheada

  const promesa = abrirSesion(datos)
  sesiones.set(datos.email, promesa)
  return promesa
}

/** El token de un rol, para pegarle a PostgREST a pelo cuando hace falta. */
export async function tokenDe(rol: Rol): Promise<string> {
  const cliente = await clienteDe(rol)
  const { data } = await cliente.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error(`Sin token para ${rol}`)
  return token
}

// ------------------------------------------------------------
// Lecturas de apoyo
// ------------------------------------------------------------

export async function empresaPorSlug(cliente: Cliente, slug: string) {
  const { data } = await cliente.from("companies").select("*").eq("slug", slug).maybeSingle()
  return data
}

export async function perfilPorEmail(cliente: Cliente, email: string) {
  const { data } = await cliente.from("profiles").select("*").eq("email", email).maybeSingle()
  return data
}

// ------------------------------------------------------------
// Escrituras: todas pasan por el guardarraíl
// ------------------------------------------------------------

/**
 * Crea una empresa de prueba con su sede, sus módulos y sus catálogos.
 *
 * Usa las mismas rutas que la aplicación —insertar y dejar que RLS decida— en
 * vez de un atajo privilegiado: si una política se rompe, el montaje de las
 * pruebas se cae, que es justo lo que debe pasar.
 */
export async function crearEmpresa(
  admin: Cliente,
  nombre: string,
  opciones: { modulos?: string[]; sede?: string } = {},
) {
  exigirDePrueba("crear empresa", nombre)

  const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  const yaExiste = await empresaPorSlug(admin, slug)
  if (yaExiste) return yaExiste

  const { data: perfil } = await admin.auth.getUser()
  const { data: empresa, error } = await admin
    .from("companies")
    .insert({
      name: nombre,
      slug,
      accent_color: "#0f766e",
      crm_label: nombre,
      created_by: perfil.user?.id ?? null,
    })
    .select("*")
    .single()
  if (error) throw new Error(`crearEmpresa(${nombre}): ${error.message}`)

  const { error: errorSede } = await admin.from("branches").insert({
    company_id: empresa.id,
    name: opciones.sede ?? "Sede principal",
    city: "Buga",
    department: "Valle del Cauca",
    is_primary: true,
    created_by: perfil.user?.id ?? null,
  })
  if (errorSede) throw new Error(`crearEmpresa/sede(${nombre}): ${errorSede.message}`)

  const modulos = opciones.modulos ?? ["ventas", "pagos", "actividad_diaria", "agendas", "caja"]
  await admin.from("company_modules").insert(
    modulos.map((module_code) => ({
      company_id: empresa.id,
      module_code,
      enabled_by: perfil.user?.id ?? null,
    })),
  )

  const { data: financiaciones } = await admin.from("financing_types").select("code, sort_order")
  if (financiaciones?.length) {
    await admin.from("company_financing_types").insert(
      financiaciones.map((f) => ({
        company_id: empresa.id,
        financing_code: f.code,
        active: true,
        sort_order: f.sort_order,
      })),
    )
  }

  const { data: medios } = await admin.from("payment_methods").select("code, sort_order")
  if (medios?.length) {
    await admin.from("company_payment_methods").insert(
      medios.map((m) => ({
        company_id: empresa.id,
        method_code: m.code,
        active: true,
        sort_order: m.sort_order,
      })),
    )
  }

  return empresa
}

/**
 * Borrado definitivo de una empresa de prueba.
 *
 * `delete_company_cascade` exige el nombre exacto, así que el guardarraíl y la
 * base coinciden en la misma condición: solo se va lo que se nombra, y solo se
 * nombra lo que lleva prefijo.
 */
export async function borrarEmpresa(admin: Cliente, slug: string) {
  exigirDePrueba("borrar empresa", slug)

  const empresa = await empresaPorSlug(admin, slug)
  if (!empresa) return
  exigirDePrueba("borrar empresa (nombre)", empresa.name)

  const { error } = await admin.rpc("delete_company_cascade", {
    target_company: empresa.id,
    confirm_name: empresa.name,
  })
  if (error) throw new Error(`borrarEmpresa(${slug}): ${error.message}`)
}

/** Deja al usuario en una empresa con un rol, en su sede principal. */
export async function asignarAEmpresa(
  admin: Cliente,
  email: string,
  slug: string,
  rol: "coordinador" | "asesor",
) {
  exigirDePrueba("asignar usuario a empresa", slug)

  const perfil = await perfilPorEmail(admin, email)
  const empresa = await empresaPorSlug(admin, slug)
  if (!perfil || !empresa) throw new Error(`asignarAEmpresa: falta perfil ${email} o ${slug}`)

  const { data: sede } = await admin
    .from("branches")
    .select("id")
    .eq("company_id", empresa.id)
    .eq("is_primary", true)
    .maybeSingle()

  const { data: yo } = await admin.auth.getUser()
  const { error } = await admin.from("company_users").upsert(
    {
      company_id: empresa.id,
      user_id: perfil.id,
      role: rol,
      branch_id: sede?.id ?? null,
      removed_at: null,
      assigned_by: yo.user?.id ?? null,
    },
    { onConflict: "company_id,user_id" },
  )
  if (error) throw new Error(`asignarAEmpresa(${email}, ${slug}): ${error.message}`)
}

/**
 * Persona del equipo enlazada a una cuenta.
 *
 * Hace falta para probar "el comercial registra lo suyo": lo que ata una venta
 * a alguien es el id de `staff`, no el de la cuenta, así que sin este enlace un
 * asesor no puede registrar nada a su nombre.
 */
export async function vincularStaff(admin: Cliente, email: string, slug: string) {
  exigirDePrueba("vincular staff", slug)

  const perfil = await perfilPorEmail(admin, email)
  const empresa = await empresaPorSlug(admin, slug)
  if (!perfil || !empresa) throw new Error(`vincularStaff: falta perfil ${email} o ${slug}`)

  const { data: existente } = await admin
    .from("staff")
    .select("id")
    .eq("profile_id", perfil.id)
    .maybeSingle()

  let staffId = existente?.id
  if (!staffId) {
    const slug = perfil.full_name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")

    const { data, error } = await admin
      .from("staff")
      .insert({ full_name: perfil.full_name, slug, profile_id: perfil.id, active: true })
      .select("id")
      .single()
    if (error) throw new Error(`vincularStaff(${email}): ${error.message}`)
    staffId = data.id
  }

  const { data: sede } = await admin
    .from("branches")
    .select("id")
    .eq("company_id", empresa.id)
    .eq("is_primary", true)
    .maybeSingle()

  await admin
    .from("company_staff")
    .upsert(
      { company_id: empresa.id, staff_id: staffId, branch_id: sede?.id ?? null },
      { onConflict: "company_id,staff_id" },
    )

  return staffId
}

/**
 * Borra todo rastro de las pruebas.
 *
 * Recorre solo lo que lleva prefijo. Lo que no lo lleve ni se mira: no hay una
 * rama de código capaz de tocar un dato del cliente.
 */
export async function limpiarTodo(admin: Cliente) {
  const { data: empresas } = await admin.from("companies").select("slug, name")
  for (const empresa of empresas ?? []) {
    if (esDePrueba(empresa.slug) && esDePrueba(empresa.name)) {
      await borrarEmpresa(admin, empresa.slug)
    }
  }
}
