# Command Center · TrámitesBuga

Plataforma de gestión comercial que reemplaza los archivos de Excel: formularios
de captura diaria, dashboards de KPIs y objetivos comerciales, por empresa cliente
y por sede.

Stack: **Next.js 16** (App Router) · **shadcn/ui** · **Tailwind 4** · **Supabase** (pendiente de conectar)

Jerarquía: **TrámitesBuga** (la instalación) → **empresas cliente** → **sedes** →
**comerciales**. El dashboard de una empresa es la suma de sus sedes, con desglose.

---

## Cómo correrlo

```bash
npm install
npm run dev      # http://localhost:3000
```

No hay login todavía. La app arranca en `/empresas` con datos de demostración y
un **selector de usuario** abajo a la izquierda del sidebar para ver la app con
cada rol (Super Admin, Coordinador, Asesor).

## Estado actual

Toda la UI funciona con datos en **localStorage**, no hay backend conectado. Los
datos persisten en el navegador y se pueden restablecer desde el menú de usuario
→ *Restablecer datos de prueba*.

El schema de Postgres ya está escrito y listo para correr en Supabase, pero no
está conectado.

> **Conectar Supabase no es cambiar un archivo.** `useDb()` devuelve toda la base
> de forma **síncrona** y se usa en **29 lugares repartidos en 16 archivos**, más
> 17 puntos de escritura. Supabase es asíncrono, así que el cambio implica queries
> por página, estados de carga y error, y revalidación después de cada escritura.
> Es la tarea más grande que queda: estimada en **~10 horas**, no en un rato.

| # | Entregable | Estado |
|---|---|---|
| 1 | Schema Postgres + vistas + RLS + seeds | escrito, sin ejecutar |
| 2 | Shell de la app (sidebar, contexto de empresa, guardas de acceso) | ✅ |
| 3 | Empresas: grid, wizard de 5 pasos, configuración, archivado | ✅ |
| 4 | Sedes: alta, sede principal, archivado, equipo por sede | ✅ |
| 5 | Usuarios: alta, invitación, asignación a sede, baja lógica, restauración | ✅ |
| 6 | Objetivos comerciales por mes y por responsable | ✅ |
| 7 | Formularios de captura (KPI Diario, Gestión Diaria, Reporte de Ventas) | ✅ |
| 8 | Dashboard y KPIs, con desglose por sede | ✅ |
| 9 | Auditoría | ✅ |
| — | Login y cuentas reales (Supabase Auth) | pendiente |
| — | Importación masiva del histórico de Excel | pendiente |

## Estructura

```
docs/ARQUITECTURA.md          Lógica funcional: roles, flujos, módulos, reglas
supabase/migrations/          Scripts SQL, en orden 001 → 004
src/lib/store/                Modelo de datos, seed y acciones (capa localStorage)
src/lib/colombia.ts           1.103 municipios por departamento (generado, no editar)
src/lib/kpi.ts                Ratios y agregados — espejo de 002_views.sql
src/components/               Shell, guardas, selector de empresa/municipio, tarjetas
src/app/(app)/empresas/       Grid de empresas y wizard de creación
src/app/(app)/e/[slug]/       Todo lo de una empresa: dashboard, sedes, formularios, config
src/app/(app)/admin/          Usuarios de plataforma y auditoría
```

## Base de datos

Los scripts se corren **en orden** en el SQL Editor de Supabase:

```
001_schema.sql   tablas, enums, constraints, triggers
002_views.sql    vistas de ratios y agregados mensuales
003_rls.sql      políticas de acceso por rol + baja lógica de usuarios
004_seed.sql     catálogos (módulos, financiaciones, medios de pago, métricas)
```

`004_seed.sql` termina con las instrucciones para crear el primer super admin.

> Los scripts todavía **no se han ejecutado contra un Postgres real**, así que la
> sintaxis no está verificada en ejecución. Presupuesta **~2 horas** para la
> primera corrida: es normal que aparezcan ajustes en los bloques `do $$`, en
> `security_invoker` de las vistas y en la recursión de las políticas RLS.

## Cuánto falta

Contra las 64 horas cotizadas, van ~26 h hechas (~46%). Lo que queda:

| Tarea | Horas |
|---|---|
| Correr el SQL en Supabase y corregir lo que falle | 2 |
| Cambiar localStorage → Supabase (29 lecturas, 17 escrituras) | 10 |
| Login, sesión, middleware, invitaciones, protección de rutas | 5 |
| Las 4 hojas faltantes del Excel: modelo + formularios | 7 |
| Importación masiva del histórico | 8 |
| Cloudflare + dominio + variables de entorno | 1 |
| QA, manual de uso y capacitación | 5 |
| **Total** | **~38** |

Con ~6 horas se llega a **la app en línea con dominio, login y base en la nube**,
pero todavía leyendo de `localStorage`. El salto de "demo desplegada" a "sistema
compartido" son las ~10 h del cambio de capa de datos.

## Despliegue en Cloudflare

Corre en **Cloudflare Workers** con el adaptador [`@opennextjs/cloudflare`](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/).

```bash
npm run preview   # build + servidor local sobre el runtime de Workers
npm run deploy    # build + publica en Cloudflare
npm run cf-typegen  # regenera los tipos de los bindings
```

La primera vez hay que autenticarse: `npx wrangler login`.

Config en `wrangler.jsonc` (`nodejs_compat`, assets en `.open-next/assets`) y
`open-next.config.ts`. Build verificado: worker + 65 archivos de assets,
**1,37 MB comprimidos**, holgado frente al límite de 3 MB del plan gratuito.

Se usa Workers y no export estático porque `/e/[slug]` es dinámica: las empresas
se crean en tiempo de ejecución y sus slugs no existen al compilar. Además Supabase
Auth necesitará middleware en el servidor.

> La cotización estimaba **Vercel**. Cloudflare cambia el costo de infraestructura
> pero no el alcance; queda anotado para la nota de infraestructura del cliente.

## Sedes

Una empresa opera en una o varias sedes y **cada comercial pertenece a una**. Todo
registro guarda su `branch_id`, así el mismo dato sirve para el total de la empresa
y para el desglose por sede, sin duplicarlo.

- Un **asesor** siempre tiene sede: es donde registra. Un **coordinador** puede
  quedar sin sede para supervisar la empresa completa.
- En KPI Diario y Gestión Diaria la sede **no se elige**: se deriva del comercial.
  En Reporte de Ventas hay selector, porque se reporta a nivel de sede.
- Las sedes se archivan, no se borran, y no se puede archivar la última activa ni
  una con comerciales asignados.

## Diseño

La UI sigue el lenguaje visual de
[square-ui dashboard-2](https://github.com/zerostaticthemes/square-ui/tree/master/templates/dashboard-2):
tipografía Geist, página gris muy claro con superficies blancas, radio de 10px,
tarjetas con chip de icono en el encabezado, y las métricas en una sola tira con
divisores en vez de tarjetas suspendidas. Solo tema claro.

La paleta de gráficas se validó con el validador de accesibilidad de datos
(separación CVD deutan ΔE 9.2, visión normal ΔE 27.6 en modo claro); las gráficas
que usan el tercer color llevan leyenda y tabla de datos porque ese tono queda bajo
3:1 de contraste sobre blanco.

## Decisiones que vale conocer

**Los usuarios no se borran.** Eliminar un usuario le revoca el acceso y marca
`deleted_at`, pero la fila permanece: los registros históricos siguen mostrando
su nombre. Además cada registro guarda `responsable_nombre` como *snapshot*, para
que un reporte de hace seis meses no cambie si alguien renombra el perfil. Las
empresas tampoco se borran: se archivan.

**Los ratios no se digitan ni se guardan.** Se calculan sobre los totales, tanto
en la UI (`src/lib/kpi.ts`) como en Postgres (`002_views.sql`), con las mismas
fórmulas. Nunca se promedian ratios diarios — el promedio de porcentajes da un
número falso; se recalcula el ratio sobre la suma de numeradores y denominadores.

**El reporte mensual no existe como dato.** Es la suma de los diarios. Así nunca
puede descuadrar contra el detalle.

**Sin dato ≠ cero.** Cuando el denominador de un ratio es 0 se muestra `—`, no
`0%`: no hay información, que es distinto de un mal resultado. Igual con las
metas: una métrica sin meta se muestra sin barra de cumplimiento en vez de
aparecer en 0%.

**Un registro por empresa + sede + fecha + responsable + jornada.** Volver a
guardar edita el existente; no se duplica.

**Los datos guardados se reconcilian con el seed.** `read()` completa con el seed
las tablas que falten en lo que hay en `localStorage`, en vez de confiar solo en el
número de versión: así un cambio de esquema no rompe la app en un navegador que ya
tenía datos.

## Hallazgo en los Excel actuales

Al cargar las cifras de los pantallazos del 15/08/2026 (Ruta Segura) como datos
de prueba, **dos de los tres totales mensuales del Excel no coinciden con la suma
de sus propias filas de detalle**:

| Total mensual | Lo que dice el Excel | Suma de sus filas de detalle | Diferencia |
|---|---|---|---|
| Facturación | $21.965.000 | $21.965.000 | ✅ cuadra |
| Ventas / Licencias | 20 / 25 | 24 / 29 | −4 / −4 |
| Recaudo | $7.423.000 | $11.861.000 | −$4.438.000 |

En ventas la diferencia es exactamente el bloque de **Addi** (4 ventas y 4
licencias), lo que sugiere que la celda del total no lo está sumando. En recaudo
no hay un bloque que explique la diferencia.

**Decisión tomada (17/08/2026):** se importa el **detalle diario tal como está** en
el Excel y el sistema calcula el mensual a partir de ahí. No se intenta reproducir
las celdas de total del archivo original.

Consecuencia esperada: los reportes mensuales del histórico mostrarán cifras
distintas a las que mostraba el Excel — para agosto 2026, 24/29 ventas y
$11.861.000 de recaudo en vez de 20/25 y $7.423.000. Es el resultado correcto del
detalle; el descuadre estaba en las fórmulas de total del archivo viejo. Conviene
avisarlo al equipo antes de la capacitación, porque alguien va a comparar.

En el sistema nuevo este descuadre no puede volver a ocurrir: el mensual no existe
como dato, es la suma de los diarios.

## Alcance vs. cotización

La cotización COT-2026-0624 dice *"acceso unificado a la plataforma (sin
diferenciación por roles)"*. Lo construido tiene **tres roles** (super admin,
coordinador, asesor), empresas cliente con módulos configurables, objetivos
comerciales y auditoría. Es alcance mayor al cotizado y queda anotado para el
ajuste de horas.
