# Despliegue en Cloudflare

Cuenta destino: **Command center** — `1f5451cb956ae09fe7a1d8074cef2912`
Worker: `command-center` · Subdominio: `commandcentergenelypse.workers.dev`

El proyecto ya está configurado: `wrangler.jsonc` fija la cuenta y el nombre del
worker, `open-next.config.ts` tiene el adaptador, y `.nvmrc` fija Node 22 para
que la build remota use la misma versión que la local.

---

## Paso 1 · Dar acceso a la cuenta Command center

La sesión actual de wrangler (`jonnieralejandrom@gmail.com`) tiene acceso a
*Gurwi*, *Jonnier* y *Rick*, **pero no a Command center**. Verificado contra la
API: `9109 Unauthorized to access requested resource`.

```bash
npx wrangler logout
npx wrangler login    # en el navegador, autoriza la cuenta Command center
npx wrangler whoami   # debe aparecer Command center en la lista
```

Si Command center pertenece a otra cuenta de Cloudflare, hay que entrar con ese
correo, o invitar a `jonnieralejandrom@gmail.com` como miembro con rol
*Workers Admin* desde **Manage Account → Members**.

## Paso 2 · Primer despliegue manual

Sirve para comprobar que todo funciona antes de automatizar:

```bash
npm run deploy
```

Queda en `https://command-center.commandcentergenelypse.workers.dev`.

## Paso 3 · Repositorio en GitHub

El despliegue automático necesita un repo. Este proyecto **no tiene remoto**.

1. Crear un repositorio **vacío** (sin README, sin .gitignore) en
   `https://github.com/new`. Sugerido: `command-center`, privado.
2. Conectarlo y subir:

```bash
git remote add origin git@github.com:jonniermartinez/command-center.git
git push -u origin main
```

La llave SSH de esta máquina ya está autorizada en GitHub como `jonniermartinez`.

## Paso 4 · Despliegue automático (Workers Builds)

En el panel: **Workers & Pages → command-center → Settings → Build**, o
**Create application → Connect to Git** si aún no existe el worker.

| Campo | Valor |
|---|---|
| Repositorio | `jonniermartinez/command-center` |
| Rama de producción | `main` |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

Este paso **solo se puede hacer desde el panel**: conectar GitHub requiere
autorizar la app de Cloudflare por OAuth, y eso no se automatiza desde la
terminal.

Desde ahí, cada `git push` a `main` despliega solo.

## Paso 5 · Dominio propio

**Workers & Pages → command-center → Settings → Domains & Routes → Add custom
domain**. Si el dominio ya está en Cloudflare, el certificado es automático.

---

## Cuando entre Supabase

Las claves **no van en el repo**. Las públicas van en `wrangler.jsonc` bajo
`vars`, y las secretas se cargan aparte:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

En Workers Builds hay que repetirlas en **Settings → Variables and Secrets**, o
la build remota fallará aunque la local funcione.

## Notas

- Tamaño actual: **1,37 MB comprimidos**, holgado frente al límite de 3 MB del
  plan gratuito.
- `observability` está activo: los logs se ven en **Workers → command-center →
  Logs** sin configurar nada más.
- Con `main` conectada a despliegue automático, **todo push a `main` sale a
  producción**. En cuanto haya un dominio en línea conviene volver a ramas y PR.

## Variables de entorno

| Archivo | Qué lleva | ¿Se versiona? |
|---|---|---|
| `.env.production` | Las públicas: URL del proyecto, clave publicable y URL del sitio | **Sí**. `NEXT_PUBLIC_*` termina dentro del bundle del navegador, así que no son secretas, y tenerlas versionadas hace que la build remota no dependa de configurar nada a mano |
| `.env.local` | Lo de la máquina de desarrollo, incluida `SUPABASE_SERVICE_ROLE_KEY` | No |
| Secret del worker | `SUPABASE_SERVICE_ROLE_KEY` en producción | — |

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### Cuidado al desplegar desde la máquina local

OpenNext **copia los archivos `.env` al bundle**, `.env.local` incluido. Si
corres `npm run deploy` desde tu portátil, la clave de servicio queda escrita
dentro del código desplegado en vez de vivir como secret.

No es catastrófico —la clave tiene que estar disponible en tiempo de ejecución
de todos modos— pero un secret no se puede leer desde el bundle y una variable
incrustada sí. Lo correcto es **desplegar desde la build remota**, que clona el
repo y por tanto no tiene `.env.local`, y registrar la clave como secret. Si
tienes que desplegar a mano, borra o vacía `SUPABASE_SERVICE_ROLE_KEY` de
`.env.local` antes de construir.

| Variable | Dónde | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente y servidor | Proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente y servidor | Clave publicable; todo lo que alcanza está acotado por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | Admin API de Auth (invitar, bloquear) y escritura del log de auditoría. Salta RLS: nunca debe llegar al navegador |
| `NEXT_PUBLIC_SITE_URL` | servidor | A dónde vuelven los enlaces de los correos de invitación |

Al cambiar de dominio hay que actualizar `NEXT_PUBLIC_SITE_URL` en
`.env.production` y las *Redirect URLs* en Supabase → Authentication → URL
Configuration, o los enlaces de invitación no regresan a la app.

## Por qué no hay proxy (middleware)

En Next 16 el antiguo `middleware.ts` se llama `proxy.ts` y **solo corre en el
runtime de Node**: la opción de runtime ni siquiera se puede declarar en ese
archivo. OpenNext para Cloudflare no lo soporta y la build falla con
`Node.js middleware is not currently supported`.

Sus dos tareas se reparten:

- **Renovar el token** lo hace el navegador. El cliente de `@supabase/ssr`
  guarda la sesión en cookies y la renueva antes de que caduque; basta con tener
  montado `<SessionKeeper />`, que además refresca la ruta cuando el token
  cambia para que los Server Components lean con el token nuevo.
- **Negar el acceso** lo hace el layout con sesión, que es donde siempre debió
  estar: un proxy que decide permisos es una guarda más que se puede saltar por
  una ruta no cubierta por su `matcher`. La defensa real siguen siendo las
  políticas RLS.

Queda un caso: quien vuelve después de una hora con la pestaña cerrada llega con
la cookie vencida y el servidor lo manda al login. Ahí `<SessionBounce />` deja
que el navegador renueve con el refresh token y lo entra derecho, sin volver a
pedirle la contraseña.
