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

## El plantel: diez cuentas fijas

| Cuenta | Rol | Para qué |
|---|---|---|
| `super_admin` | super admin | La semilla. La única que no puede crear nadie desde dentro |
| `super_admin_2` | super admin | El relevo del rol con más poder |
| `coordinador_a` | coordinador | Administra la empresa A |
| `coordinador_b` | coordinador | Administra la B: administrar una no da permiso sobre otra |
| `asesor_a1` | asesor | Comercial de A: registra lo suyo |
| `asesor_a2` | asesor | Su compañero en A: sin él no se prueba "lo de otra persona" |
| `asesor_b1` | asesor | Comercial de B: el aislamiento entre empresas |
| `suspendido` | asesor | Suspendida de verdad: perfil inactivo y login bloqueado |
| `sin_empresa` | asesor | Entra pero no está en ninguna empresa |
| `reserva` | asesor | Libre, para la próxima prueba que necesite un rol más |

Todas son `e2e_command_<slug>@jonnier.com`, y sus contraseñas están en
`.env.e2e`, que no se versiona.

**Se crean una vez y se reutilizan.** Ese es el punto: antes las creaba cada
prueba y la pantalla de usuarios del cliente terminó con decenas de cuentas de
mentira mezcladas con su gente. Lo que se monta y se destruye en cada corrida
son **las empresas**, no las personas.

Ninguna recibe correo. Nacen confirmadas y con contraseña, igual que hace la
aplicación al dar de alta al equipo de una empresa sin esperar invitaciones.

El fixture `mundo` crea dos empresas por proceso, mete a cada quien en la suya
y al terminar las borra —lo que se lleva las asignaciones y todo lo capturado
dentro. El barrido de arranque limpia lo que dejara una corrida interrumpida,
pero **respeta el plantel**.

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

### Los flujos que dependen del correo (fuera de la suite)

No hay pruebas de correo. El remitente por defecto de Supabase va limitado a
unos pocos envíos por hora, así que una prueba que dependa de recibir un correo
falla por la cuota y no por el código: ruido rojo que no dice nada.

La infraestructura sí está montada y lista, por si se retoma cuando haya SMTP
propio: un Email Worker en `e2e/correo-worker/`, diez direcciones enrutadas y
`soporte/correo.ts` para leerlas. Ninguna prueba la usa hoy.

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
