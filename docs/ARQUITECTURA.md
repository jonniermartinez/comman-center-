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
    ├─ Usuarios asignados (con rol por empresa)
    ├─ Módulos habilitados
    ├─ Configuración (financiaciones, medios de pago, sedes)
    ├─ Objetivos comerciales (por mes)
    └─ Registros diarios → Dashboard + KPIs
```

Un usuario puede estar asignado a **varias** empresas. Un asesor solo ve las suyas.

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
│  Usuarios            │
│  Configuración       │
└──────────────────────┘
```

Cuando un `super_admin` entra a una empresa, no hay impersonación de usuario:
entra con su propia identidad y permisos totales. Toda acción suya sobre datos de
otro usuario queda en `audit_log`.

### 3.3 Crear una empresa — wizard de 4 pasos

`/empresas/nueva`

1. **Datos** — nombre, NIT, ciudad, logo, color de acento.
2. **Módulos** — checklist del catálogo (KPI Diario, Gestión Diaria, Reporte de
   Ventas, CRM). Define qué formularios y qué secciones del dashboard existen.
3. **Configuración comercial** — financiaciones activas (Brilla, Contado, 50/50,
   Sistecrédito, Addi, Solvente) y medios de recaudo (Datáfono, Efectivo,
   Transferencia, …). Se precargan las estándar y se desmarcan las que no aplican.
4. **Usuarios** — asignar usuarios existentes o invitar nuevos, con su rol.

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
- Un registro por **empresa + fecha + responsable + jornada**. Reenviar edita.
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

## 6. Auditoría

`audit_log` registra: quién, qué acción, sobre qué tabla y registro, valores
antes/después y cuándo. Se escribe en: creación/edición/archivado de empresas,
alta/baja/edición de usuarios y asignaciones, cambios de objetivos, y edición de
registros de días cerrados o de registros ajenos.

---

## 7. Orden de construcción

| # | Entregable | Estado |
|---|---|---|
| 1 | Schema Postgres + RLS + seeds (`supabase/migrations`) | pendiente |
| 2 | Auth + shell de la app (sidebar, contexto de empresa) | pendiente |
| 3 | Módulo de empresas: grid, wizard, configuración | pendiente |
| 4 | Módulo de usuarios: alta, asignación, soft delete | pendiente |
| 5 | Objetivos comerciales | pendiente |
| 6 | Formularios de captura (4 módulos) | pendiente |
| 7 | Dashboards y KPIs | pendiente |
| 8 | Importación masiva del histórico de Excel | pendiente |
