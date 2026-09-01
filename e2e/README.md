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
| `e2e_command_super_admin@jonnier.com` | super admin | toda la plataforma |
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

## La tabla de permisos que prueban

| | crear | corregir | eliminar |
|---|---|---|---|
| Ventas, Pagos, Agendas, Jornada | a nombre propio, o quien administra | **cualquiera de la empresa** | lo suyo, o quien administra |
| Caja | solo quien administra | solo quien administra | solo quien administra |

Corregir lo de un compañero se permite y borrarlo no, y no es un descuido: una
corrección deja rastro y se puede deshacer; un borrado no deja nada que
revisar. La caja va aparte porque es el dinero físico del punto.

## Los archivos van en el orden del software

No en orden alfabético: en el orden en que se usa el sistema. Así el árbol de
pruebas se lee como el recorrido de alguien que empieza de cero.

```
01-login            entrar
02-usuarios         crear cuentas con cada rol
03-empresas         dar de alta la empresa
04-sedes            dónde opera
05-equipo           quién trabaja ahí
06-configuracion    qué módulos y catálogos usa
07-objetivos        las metas del mes
08-ventas   09-pagos   10-agendas   11-gestion-diaria   12-caja
13-dashboard        lo que se mira cada día
14-auditoria        quién hizo qué
15..17              permisos y guardarraíl
18-correo  19-estabilidad
```

### Una sola definición de "CRUD completo"

Los cinco módulos de captura se comportan igual, así que sus ocho pruebas de
capacidades viven una sola vez en `soporte/matriz.ts` y cada módulo las invoca
con lo suyo:

```ts
test.describe("Ventas", () => {
  for (const caso of capacidadesDe(VENTA)) test(caso.titulo, caso.ficha, caso.prueba)
})
```

`capacidadesDe` devuelve definiciones en vez de registrar las pruebas, y no es
un capricho: Playwright atribuye cada prueba al archivo donde se declara. Si
`matriz.ts` llamara a `test()`, las cuarenta y cinco aparecerían amontonadas
bajo ese archivo y el árbol dejaría de leerse por módulos. Declarándolas cada
uno, el código se comparte igual y cada prueba sale donde le toca.

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

**Ya funcionan.** `e2e/features/correo.spec.ts` cubre recuperación de
contraseña, invitación de usuario, que un enlace de un solo uso no sirva dos
veces, y que pedir recuperación de un correo inexistente no delate si existe.

Detrás hay un Email Worker propio, `e2e/correo-worker/`, desplegado en la
cuenta **Jonnier** (donde vive la zona `jonnier.com`; Email Routing solo entrega
a workers de su misma cuenta). Hace falta porque Email Routing **solo reenvía**:
no guarda nada ni tiene API de lectura.

No se reutilizó `gurwi-e2e-mail`, que ya existía en esa zona: solo rescata
códigos de seis dígitos y tira el resto, y los correos de Supabase traen un
enlace. Además es de otro proyecto.

```
GET    /correos?email=…   →  { correos: [...] }   lista, más reciente primero
DELETE /correos?email=…   →  vacía el buzón
```
Ambos con `Authorization: Bearer $E2E_MAIL_SECRET`.

#### Ninguna prueba manda correo a un buzón personal

La zona tiene un catch-all que reenvía todo lo no enrutado a
`jonnieralejandrom@gmail.com`. Por eso **las siete direcciones de prueba tienen
regla explícita** apuntando al worker, y todas comparten un prefijo propio del
proyecto:

```
e2e_command_*@jonnier.com
```

Un prefijo por proyecto, igual que `gurwi-e2e-mail` tiene el suyo: así se sabe
de un vistazo de quién es cada dirección, y el worker rechaza todo lo demás.

> **Al añadir una dirección de prueba nueva, crea primero su regla de
> enrutamiento.** Sin regla cae en el catch-all y llega al correo personal. Por
> eso la prueba que necesita una dirección inexistente usa `.invalid`, no
> `jonnier.com`.

## Dos cosas rotas que encontraron estas pruebas

1. **La Site URL de Supabase es `http://localhost:3000`.** El enlace de
   "olvidé mi contraseña" que llega en producción manda a localhost. Se cambia
   en Authentication → URL Configuration.
2. **La plantilla de correo usa `{{ .ConfirmationURL }}`**, que apunta al
   `/auth/v1/verify` de Supabase en vez de al `/auth/confirm` de la aplicación.
   Las pruebas construyen la ruta a mano para poder seguir; una persona real no
   puede. Ver `docs/SUPABASE.md`.

## Volver a crear las cuentas

Si se pierde `.env.e2e`, las cuentas siguen existiendo pero sin sus
contraseñas. Se les pone una nueva desde la app (Usuarios → restablecer) o con
`admin_set_password` desde una sesión de super admin, y se apunta en
`.env.e2e` siguiendo el formato de `entorno.ts`.
