import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refresco de sesión en cada petición.
 *
 * En Next 16 este archivo se llama `proxy.ts` (antes `middleware.ts`) y corre
 * antes de renderizar. Su único trabajo es renovar el token de Supabase y
 * dejar las cookies actualizadas; **no** decide permisos: eso lo hacen las
 * políticas RLS de Postgres y las guardas de cada layout. Acá solo se manda al
 * login a quien no tiene sesión, para no renderizar una pantalla vacía.
 */
const RUTAS_PUBLICAS = ["/login", "/auth", "/definir-clave", "/recuperar"]

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // getClaims valida el JWT y, de paso, dispara el refresco de la sesión.
  // No se pone lógica entre createServerClient y esta llamada: cualquier
  // return anticipado dejaría la sesión sin renovar y cerraría sesiones al azar.
  const { data } = await supabase.auth.getClaims()

  const { pathname } = request.nextUrl
  const esPublica = RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  )

  if (!data?.claims && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    // Para volver a donde iba después de entrar.
    if (pathname !== "/") url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // El rebote de /login a la app se salta cuando la URL trae un error: si no,
  // un usuario con sesión pero sin perfil quedaría rebotando entre las dos.
  if (data?.claims && pathname === "/login" && !request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone()
    url.pathname = "/empresas"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Todo menos estáticos e imágenes: si el proxy corriera sobre ellos, un
     * redirect a /login rompería el CSS y los assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
