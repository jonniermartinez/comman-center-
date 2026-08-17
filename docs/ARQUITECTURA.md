# Command Center — Arquitectura funcional

Software de gestión comercial para **TrámitesBuga** (empresa operadora).
No es SaaS multi-tenant: es una sola instalación. Las "empresas" son los **clientes**
de TrámitesBuga (Ruta Segura, LV Unión, …).

Stack: Next.js 15 (App Router) · Supabase (Postgres + Auth) · shadcn/ui · Tailwind

---

## 1. Jerarquía del sistema

```
Instalación (TrámitesBuga)
├─ Usuarios            → los habilita el Super Admin. No hay auto-registro.
└─ Empresas (clientes)
    ├─ Sedes
    │   └─ Comerciales asignados → sus registros diarios
    ├─ Módulos habilitados
    ├─ Configuración (financiaciones, medios de pago)
    ├─ Objetivos comerciales (por mes, por empresa y por comercial)
    └─ Dashboard = suma de sus sedes, con desglose por sede
```

Un usuario puede estar asignado a **varias** empresas. Un asesor solo ve las suyas.

### Sedes

Una empresa opera en una o varias sedes y **cada comercial pertenece a una sede**.
Todo registro queda atado a su sede (`branch_id`), lo que permite dos lecturas sin
duplicar datos: el total de la empresa y el desglose por sede.

- La primera sede de una empresa queda como **principal**. Los registros a nivel
  de empresa (facturación, recaudo) se atribuyen a la sede que los reportó.
- Un **asesor** siempre tiene sede: es donde registra. La restricción
  `company_users_asesor_con_sede` lo garantiza en la base.
- Un **coordinador** puede quedar **sin sede** para supervisar la empresa completa.
- Las sedes se **archivan**, no se borran, y no se puede archivar la última sede
  activa ni una que tenga comerciales asignados.
- En KPI Diario y Gestión Diaria la sede **no se elige**: se deriva del comercial.
  En Reporte de Ventas sí hay selector, porque se reporta a nivel de sede.

---

## 2. Roles

| Rol | Alcance | Puede |
|---|---|---|
| `super_admin` | Toda la instalación | Crear/editar/archivar empresas · crear y habilitar usuarios · eliminar usuarios (soft delete) · asignar usuarios a empresas · habilitar módulos · definir objetivos · ver y editar todo · ver auditoría |
| `coordinador` | Solo empresas asignadas | Ver dashboards y reportes completos de sus empresas · definir objetivos de sus empresas · revisar/corregir registros de su equipo · **no** crea usuarios ni empresas |
| `asesor` | Solo empresas asignadas | Llenar sus formularios del día · ver sus propios KPIs y el dashboard de la empresa · **no** edita registros de otros ni ve el módulo de administración |

El rol vive en dos niveles:
- `profiles.role` → rol global (`super_admin` es global).
- `company_users.role` → rol dentro de esa empresa (`coordinador` / `asesor`).

### Usuario sin acceso

Un usuario puede existir en el sistema y **no ver absolutamente nada**. Es el caso
que hay que probar siempre, porque es el que valida que los permisos cierran.

| Estado del usuario | Qué ve |
|---|---|
| `invitado` — nunca definió contraseña | Nada. En producción `is_active_user()` es falso, así que RLS le niega hasta los catálogos |
| `activo` sin empresas asignadas | Nada. Pantalla que explica que no tiene acceso; sin sidebar de navegación |
| `inactivo` — suspendido | Nada. Mensaje de acceso suspendido |
| `eliminado` | No puede entrar. Sus registros siguen en el sistema a su nombre |

Reglas que se cumplen en este estado:

- **La URL no otorga acceso.** Entrar a `/e/ruta-segura` a mano muestra la pantalla
  de sin acceso, no el dashboard.
- **El sidebar no revela estructura.** No aparecen los módulos de la empresa: saber
  que "Ruta Segura tiene Reporte de Ventas" ya es información. Ni el título del
  header lo insinúa.
- **No se muestran ceros.** No es que sus cifras estén en cero, es que no tiene
  permiso de leerlas: son dos cosas distintas y la UI dice la correcta.
- **No puede enumerar usuarios.** `profiles_select` solo devuelve su propio perfil
  y los de gente con la que comparte empresa.

Usuarios de prueba en el seed: **Pedro Salazar** (activo, cero empresas) y
**Marcela Ruiz** (invitada). Se cambia de usuario desde el pie del sidebar.

---

## 3. Navegación y flujos

### 3.1 Home del Super Admin — `/empresas`

Grid de tarjetas, una por empresa cliente:

```
┌──────────────────────────┐  ┌──────────────────────────┐
│ ◆ Ruta Segura            │  │ ◆ LV Unión               │
│   4 usuarios · 3 módulos │  │   2 usuarios · 2 módulos │
│                          │  │                          │
│   Ventas mes      20/30  │  │   Ventas mes      8/15   │
│   ▓▓▓▓▓▓▓▓▓░░░░░  67%    │  │   ▓▓▓▓▓░░░░░░░░  53%     │
│   Facturación  $21.9M    │  │   Facturación  $6.2M     │
│                          │  │                          │
│   ● 2 registros hoy      │  │   ⚠ sin registrar hoy    │
│   [ Entrar → ]  [ ⚙ ]    │  │   [ Entrar → ]  [ ⚙ ]    │
└──────────────────────────┘  └──────────────────────────┘
                    [ + Nueva empresa ]
```

Arriba, franja de métricas consolidadas de todas las empresas: ventas del mes,
facturación, recaudo, % de cumplimiento global, empresas sin registrar hoy.

Los otros roles no ven `/empresas` como grid administrable: si tienen una sola
empresa asignada entran directo a su dashboard; si tienen varias, ven el mismo
grid pero solo con sus empresas y sin acciones de administración.

### 3.2 Entrar al dashboard de una empresa — `/e/[slug]`

Al entrar, la empresa activa queda en el contexto y el sidebar muestra **solo los
módulos habilitados** para ella. Un selector en el sidebar permite saltar a otra
empresa sin volver al grid.

```
┌─ Sidebar ────────────┐
│ [◆ Ruta Segura   ▾]  │ ← selector de empresa
│                      │
│  Dashboard           │
│  ─ Registrar ─       │
│  KPI Diario          │ ← solo módulos habilitados
│  Gestión Diaria      │
│  Reporte de Ventas   │
│  ─ Análisis ─        │
│  Reportes            │
│  Objetivos           │
│  ─ Administrar ─     │ ← solo super_admin / coordinador
│  Sedes               │
│  Equipo              │
│  Configuración       │
└──────────────────────┘
```

Cuando un `super_admin` entra a una empresa, no hay impersonación de usuario:
entra con su propia identidad y permisos totales. Toda acción suya sobre datos de
otro usuario queda en `audit_log`.

### 3.3 Crear una empresa — wizard de 5 pasos

`/empresas/nueva` — wizard de 5 pasos

1. **Datos** — nombre, NIT, municipio (selector con los 1.103 municipios de
   Colombia), color de acento y nombre del CRM.
2. **Sedes** — una o varias, cada una con su municipio. La primera es la principal.
3. **Módulos** — checklist del catálogo (KPI Diario, Gestión Diaria, Reporte de
   Ventas). Define qué formularios y qué secciones del dashboard existen.
4. **Configuración comercial** — financiaciones activas (Brilla, Contado, 50/50,
   Sistecrédito, Addi, Solvente) y medios de recaudo (Datáfono, Efectivo,
   Transferencia, …). Se precargan las estándar y se desmarcan las que no aplican.
5. **Equipo** — asignar comerciales existentes, con su rol **y su sede**.

Al terminar, la empresa nace `activa` y lista para recibir registros.

### 3.4 Crear y habilitar usuarios — `/admin/usuarios`

No hay registro público. El flujo es:

1. Super admin crea el usuario: nombre, email, rol global, empresas asignadas.
2. El sistema crea el usuario en Supabase Auth y envía invitación por email.
3. El usuario define su contraseña y entra. Queda `activo`.

Estados del usuario: `invitado` → `activo` → `inactivo` (suspendido, puede
reactivarse) → `eliminado`.

### 3.5 Eliminación de usuarios — soft delete

Requisito: **al eliminar un usuario, sus datos permanecen en el sistema con su nombre.**

- Nunca se hace `DELETE` sobre `profiles` ni sobre registros.
- Eliminar marca `deleted_at`, `deleted_by` y `status = 'eliminado'`.
- Se revoca el acceso (se deshabilita en Auth). No puede volver a entrar.
- Todos sus registros históricos siguen existiendo y siguen mostrando su nombre.
  El nombre se conserva porque `profiles` no se borra; además cada registro guarda
  `responsable_nombre` como snapshot, para que los reportes históricos no cambien
  si alguien renombra el perfil.
- En listas y filtros aparece como `Nuñez Juan (eliminado)`, atenuado.
- Un usuario eliminado no se puede seleccionar para registros nuevos.
- El super admin puede restaurarlo (`deleted_at = null`) desde la vista de
  usuarios eliminados.

Lo mismo aplica a **empresas**: se archivan, no se borran.

### 3.6 Objetivos comerciales — `/e/[slug]/objetivos`

Se definen **por empresa, por mes, por métrica**, y opcionalmente **por usuario**.

```
Objetivos · Ruta Segura · Agosto 2026            [ Copiar del mes anterior ]

Métrica                    Meta empresa   Nuñez Juan   Manzano Daniela
Ventas mensuales                    30          15            15
Licencias mensuales                 40          20            20
Facturación                 30.000.000  15.000.000    15.000.000
Recaudo                     12.000.000   6.000.000     6.000.000
Ratio contactabilidad (%)           75          75            75
Ratio conversión llamada (%)        10          10            10
```

Reglas:
- Si hay metas por usuario, la suma se valida contra la meta de empresa y se
  advierte (no bloquea) si no cuadra.
- Si una métrica no tiene meta, en el dashboard se muestra el valor sin barra de
  cumplimiento.
- El cumplimiento se calcula contra el acumulado real del mes:
  `real / meta`, y se proyecta según días hábiles transcurridos.
- Los objetivos de meses cerrados quedan bloqueados (solo super admin los edita).

---

## 4. Módulos (formularios que reemplazan el Excel)

Los módulos son un **catálogo fijo con tablas tipadas** (no formularios genéricos):
así los ratios, agregados y reportes mensuales se calculan en SQL sin ambigüedad.
Habilitar/deshabilitar por empresa es lo configurable.

Todos los registros comparten: `empresa`, `fecha_reporte`, `responsable`
(usuario) y, donde aplica, `jornada` (`inicial` / `medio_dia` / `final`).

### Módulo 1 — KPI Diario
Captura por jornada. Campos y ratios derivados (calculados, no digitados):

| Campo | Tipo |
|---|---|
| Llamadas realizadas | entero |
| Llamadas contestadas | entero |
| Ventas efectivas | entero |
| Agendas del día | entero |
| Atención agendas | entero |
| Total clientes atendidos | entero |
| Ventas exitosas (presencial) | entero |
| Llamada agenda | entero |

Ratios automáticos:
- Volumen venta general = ventas efectivas / llamadas contestadas
- Ratio conversión llamada = ventas efectivas / llamadas realizadas
- Ratio contactabilidad = llamadas contestadas / llamadas realizadas
- Ratio conversión agendas = atención agendas / agendas del día
- Ratio venta presencial = ventas exitosas / total clientes atendidos
- Volumen venta agendas = llamada agenda / llamadas contestadas

Validaciones: contestadas ≤ realizadas · atención agendas ≤ agendas del día ·
ventas exitosas ≤ total clientes atendidos.

### Módulo 2 — Gestión Diaria (CRM)
Estado del CRM por jornada:
Chats por responder · Tareas del día · Tareas caducadas · Certificados.
El dashboard compara `inicial` vs `final` para mostrar cuánto se depuró en el día.

Ruta Segura y LV Unión usan **los mismos campos** en este módulo (así están hoy en
el Excel), solo cambia el nombre del CRM que usa cada una. Por eso es un único
módulo y el nombre del CRM es un dato de configuración de la empresa
(`crm_label`), no un módulo aparte.

### Módulo 3 — Reporte de Ventas
Por cada financiación activa de la empresa: **ventas** y **licencias**.
Más tres bloques:
- **Renovaciones** por financiación.
- **Facturación** por financiación (monto).
- **Recaudo** por medio de pago (monto).

El **reporte mensual** no se digita: es la suma de los diarios del mes.

### Reglas de captura (para todos)
- Un registro por **empresa + sede + fecha + responsable + jornada**. Reenviar edita.
- No se permite registrar fechas futuras.
- Editar un registro de un día ya cerrado requiere rol `coordinador` o superior y
  queda en `audit_log`.
- Versión móvil: los formularios se llenan desde el celular, campos grandes,
  teclado numérico, guardado por sección.

---

## 5. Dashboard de empresa

Tres alcances con el mismo layout: **Día · Mes · Rango**, con filtros por
responsable y por módulo.

1. **Fila de cumplimiento** — tarjetas de ventas, licencias, facturación y recaudo
   del mes, cada una con meta, real y barra de avance.
2. **Embudo del día** — llamadas realizadas → contestadas → agendas → ventas, con
   los seis ratios del KPI Diario.
3. **Ventas por financiación** — barras y tabla ventas/licencias.
4. **Facturación y recaudo** — evolución diaria del mes.
5. **Ranking de responsables** — tabla comparativa contra su meta individual.
6. **Estado de captura** — quién ya registró hoy y quién no, por jornada.

---

## 6. Seguridad a nivel de fila (RLS)

Los permisos **no viven en la interfaz**, viven en Postgres. La UI oculta lo que el
usuario no puede tocar, pero si alguien llama a la API directamente la base
devuelve vacío igual. Las guardas de React son comodidad, no la defensa.

Funciones auxiliares (todas `security definer`, para no disparar recursión al
consultar `profiles` o `company_users` dentro de una política):

| Función | Responde |
|---|---|
| `is_super_admin()` | ¿Es super admin, activo y no eliminado? |
| `is_active_user()` | ¿Está activo y no eliminado? Un invitado da falso |
| `company_role(empresa)` | Su rol en esa empresa, o null si no está asignado |
| `has_company_access(empresa)` | ¿Puede leer esa empresa? |
| `can_manage_company(empresa)` | ¿Es super admin o coordinador de esa empresa? |
| `shares_company(usuario)` | ¿Comparte alguna empresa con ese usuario? |

Decisiones que vale conocer:

- **`profiles` no es público.** Un usuario ve su perfil, y los de gente con la que
  comparte empresa. Nada más. La tentación es abrirlo "para mostrar el nombre del
  responsable en los reportes", pero eso permitiría que cualquiera listara los
  correos y teléfonos de toda la plataforma. No hace falta: cada registro guarda
  `responsable_nombre` como snapshot, precisamente para esto.
- **Nada tiene política de `DELETE`** sobre `profiles`, `companies`, `branches` ni
  los registros históricos. Toda baja es lógica.
- **Las políticas igualan a la UI.** Si la interfaz deja a un coordinador reasignar
  la sede de un comercial, la política de `company_users` tiene que permitirlo; si
  no, la app funciona en el prototipo y falla en producción con error de permisos.
- **Las vistas usan `security_invoker = true`.** Por defecto una vista en Postgres
  se ejecuta con los permisos de su dueño y **salta RLS**: sin esa opción,
  `v_monthly_totals` le mostraría a cualquiera los totales de todas las empresas.

## 7. Auditoría

`audit_log` registra: quién, qué acción, sobre qué tabla y registro, valores
antes/después y cuándo. Se escribe en: creación/edición/archivado de empresas,
alta/baja/edición de usuarios y asignaciones, cambios de objetivos, y edición de
registros de días cerrados o de registros ajenos.

---

## 8. Orden de construcción

| # | Entregable | Estado |
|---|---|---|
| 1 | Schema Postgres + vistas + RLS + seeds (`supabase/migrations`) | escrito, sin ejecutar |
| 2 | Shell de la app (sidebar, contexto de empresa, guardas) | ✅ |
| 3 | Módulo de empresas: grid, wizard de 5 pasos, configuración, archivado | ✅ |
| 4 | Módulo de sedes: alta, principal, archivado, equipo por sede | ✅ |
| 5 | Módulo de usuarios: alta, asignación a sede, baja lógica | ✅ |
| 6 | Objetivos comerciales | ✅ |
| 7 | Formularios de captura (3 módulos) | ✅ |
| 8 | Dashboards y KPIs, con desglose por sede | ✅ |
| 9 | Auditoría | ✅ |
| 10 | Login y cuentas reales (Supabase Auth) | pendiente |
| 11 | Importación masiva del histórico de Excel | pendiente |

Los puntos 2 a 8 corren hoy contra `localStorage`.

Conectar Supabase **no** es reemplazar un archivo: `useDb()` entrega toda la base
de forma síncrona y se consume en 29 lugares de 16 archivos, con 17 puntos de
escritura. Al pasar a Supabase (asíncrono) hay que introducir queries por página,
estados de carga y error, y revalidación tras cada escritura. Estimado: ~10 horas.
