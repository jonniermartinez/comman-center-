# Pruebas end-to-end

Corren con Playwright **contra el despliegue de producción**:
`https://comman-center.commandcentergenelypse.workers.dev`

```bash
npx playwright test                  # todo
npx playwright test --project=seguridad
npx playwright test --ui             # modo interactivo
E2E_SIN_LIMPIEZA=1 npx playwright test   # deja el banco de pruebas en pie
npx playwright show-report
```

## Por qué esto es seguro contra producción

En esa base viven 16.547 ventas y 19.110 pagos reales, sin copia de seguridad.
Las pruebas escriben ahí. Lo que hace que eso sea defendible:

1. **Todo lo que crean las pruebas empieza por `e2e-`.**
2. **`soporte/guardarrail.ts` es la única puerta a cualquier borrado.** Si el
   nombre no lleva el prefijo, lanza excepción en vez de borrar. No hay una
   segunda ruta: la limpieza y las pruebas pasan por ahí.
3. **Las cinco empresas del cliente están en una lista negra explícita**
   (`tramites`, `ruta-segura`, `lv`, `ttc`, `cea`). Es redundante mientras el
   prefijo funcione, y por eso vale: si alguien relaja el prefijo, siguen
   protegidas.
4. **Ninguna prueba usa `service_role`.** Se entra con las mismas credenciales y
   la misma clave publicable que un usuario, así que ninguna puede hacer nada
   que un usuario no pudiera hacer.

Aun así, la recomendación sigue siendo mover esto a una rama de Supabase o a un
proyecto aparte en cuanto haya ocasión: los guardarraíles protegen del error
previsible, no de todos.

## El banco de pruebas

Lo monta `soporte/montaje.ts` antes de cada corrida, de forma idempotente, y lo
deshace `soporte/desmontaje.ts` al final.

| Cuenta | Rol | Dónde |
|---|---|---|
| `e2e_super_admin@jonnier.com` | super admin | toda la plataforma |
| `e2e_coordinador@jonnier.com` | coordinador | empresa A |
| `e2e_asesor_a@jonnier.com` | asesor | empresa A |
| `e2e_asesor_b@jonnier.com` | asesor | empresa B |
| `e2e_suspendido@jonnier.com` | asesor suspendido | ninguna |

Son **dos** empresas a propósito (`e2e-sandbox-a` y `e2e-sandbox-b`): casi toda
la seguridad que hay que demostrar es "lo de A no se ve desde B", y eso no se
puede probar con una sola.

Las credenciales están en `.env.e2e`, que no se versiona. Para regenerarlo, ver
"Volver a crear las cuentas" más abajo.

## Cómo están escritas

Cada rol tiene dos caras en las pruebas, y las dos hacen falta:

- `superAdmin`, `coordinador`, `asesorA`, `asesorB` — una pestaña con su sesión.
  Prueba **qué ve la persona**.
- `apiSuperAdmin`, `apiAsesorA`… — un cliente de Supabase con su sesión. Prueba
  **qué le daría la base si preguntara por su cuenta**, sin pasar por la
  interfaz.

La segunda es la que vale para seguridad. Que a un asesor no se le pinte un
botón no demuestra nada: los botones se pintan con las herramientas del
navegador. Lo que hay que demostrar es que la base le dice que no.

### Toda prueba negativa lleva control positivo

Una prueba como "el asesor no puede escribir en otra empresa" pasa en verde si
el `INSERT` falla por una columna mal escrita, sin haber probado ni una
política. Por eso los payloads se construyen en `soporte/datos.ts` con las
columnas reales, y la misma fila se inserta primero donde **sí** está
permitida. Si el control positivo falla, la prueba falla: no hay verde barato.

## Qué está cubierto

**Seguridad** (`e2e/seguridad/`) — 29 pruebas

- RLS directa: anónimo, aislamiento entre empresas, aislamiento frente a las
  empresas reales del cliente, "el comercial registra lo suyo", el coordinador
  escribe por su equipo, el log de auditoría no se escribe ni se lee a mano.
- Escalada de privilegios: las funciones `admin_*` rechazan a asesor y
  coordinador; un asesor no se asciende ni borra empresas.
- Acceso por interfaz: sin sesión, cuenta suspendida, contraseña incorrecta,
  y qué navegación ve cada rol.

**Features** (`e2e/features/`) — 4 pruebas

- Alta de empresa, incluida la regresión del doble clic (31/08/2026: siete
  empresas idénticas creadas con 330 ms de diferencia).
- Borrado definitivo: el conteo llega y el nombre exacto es obligatorio.

## Lo que falta

### Formularios de captura

Faltan las pruebas de los seis formularios: ventas, pagos, jornada, agenda,
movimiento de caja y las ediciones de cada uno. La infraestructura ya está
—cuentas, empresas, sedes, catálogos, persona enlazada— así que es escribir los
casos, no montar nada.

### Los flujos que dependen del correo

Sin cubrir: **invitación de usuario** y **recuperación de contraseña**. Son los
dos únicos que necesitan leer un correo de verdad; todo lo demás usa cuentas ya
confirmadas con contraseña conocida.

`jonnier.com` está en Cloudflare con Email Routing activo (MX
`route1/2/3.mx.cloudflare.net`), pero **Email Routing solo reenvía: no guarda
nada y no tiene API de lectura**. Para que una prueba pueda leer el enlace de
invitación hace falta:

1. Un **Email Worker** enganchado a `e2e_*@jonnier.com` que guarde el mensaje
   (KV o D1) y lo exponga por HTTP con un token.
2. Un helper `soporte/correo.ts` que consulte ese endpoint hasta que llegue el
   mensaje y saque el `token_hash` del enlace.
3. Las dos pruebas.

Requiere acceso a Cloudflare: `npx wrangler login` o un `CLOUDFLARE_API_TOKEN`
con permiso sobre Workers y Email Routing de esa zona.

**Además, la plantilla de Magic Link tiene que apuntar a `/auth/confirm`**
(ver `docs/SUPABASE.md`), o la invitación muere en "enlace inválido" tanto en
las pruebas como en la vida real.

## Volver a crear las cuentas

Si se pierde `.env.e2e`, las cuentas siguen existiendo pero sin sus
contraseñas. Se les pone una nueva desde la app (Usuarios → restablecer) o con
`admin_set_password` desde una sesión de super admin, y se apunta en
`.env.e2e` siguiendo el formato de `entorno.ts`.
