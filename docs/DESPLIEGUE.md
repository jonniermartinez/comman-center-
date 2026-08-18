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
