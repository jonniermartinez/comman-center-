# Supabase — puesta en marcha

Proyecto: `yooqgcqdssvtkkschkku` · `https://yooqgcqdssvtkkschkku.supabase.co`

## 1. Migraciones aplicadas

Se corrieron en este orden y ya están en la base:

| # | Migración | Qué deja |
|---|---|---|
| 001 | `schema` | Tablas, enums, índices y triggers (`updated_at`, snapshot del responsable, rechazo de fecha futura y de usuario eliminado) |
| 002 | `views` | Ratios del KPI, agregados mensuales, comparativo de gestión diaria, cumplimiento de objetivos |
| 003 | `rls` | Políticas por rol, helpers `security definer`, `soft_delete_user` / `restore_user` |
| 004 | `catalogos` | Módulos, financiaciones, medios de recaudo y métricas. **Sin datos de ejemplo** |
| 005 | `auth_glue` | Enganche `auth.users` ↔ `profiles` y función `me()` |
| 006 | `permisos_funciones` | Quita de la API pública las funciones que no debe poder llamar quien no ha entrado |
| 007 | `vista_actividad_usuario` | Cuántos registros tiene a su nombre cada usuario |

Dos cosas que cambiaron respecto al SQL escrito antes, porque tal cual no corría
ni era seguro:

- **`check (report_date <= current_date)` no es válido.** Postgres exige que las
  funciones dentro de un CHECK sean inmutables y `current_date` no lo es: "hoy"
  cambia. La regla pasó a un trigger (`reject_future_date`).
- **`profiles_update_propio` se consultaba a sí misma.** La política comparaba
  contra `(select role from profiles where id = auth.uid())`, y una subconsulta a
  `profiles` dentro de una política *de* `profiles` vuelve a evaluar la política:
  recursión infinita. Ahora usa `my_role()` / `my_status()`, que son
  `security definer` y no disparan RLS.

## 2. Primer usuario (huevo y gallina)

No hay registro público, así que el primer super admin no puede crearse desde la
app: no habría nadie con permiso para crearlo. Lo resuelve el trigger
`handle_new_auth_user`: **el primer usuario que aparezca en `auth.users` nace
`super_admin` y `activo`**. Del segundo en adelante, todos nacen `invitado` con
el rol que traiga la invitación.

Para crearlo:

1. Supabase → **Authentication → Users → Add user**.
2. Correo y contraseña, con *Auto Confirm User* marcado.
3. Entrar en `/login` con esos datos. Ya se es super admin.

## 3. Ajustes en el panel de Supabase

Nada depende del correo: no hay invitaciones, ni códigos, ni recuperación de
contraseña. No hace falta SMTP.

1. **Registro público apagado.** Authentication → Sign In / Providers → Email
   → *Allow new users to sign up* en **off**. La base lo bloquea igual (el
   trigger `handle_new_auth_user` rechaza cualquier alta que no venga de
   `admin_create_user`), pero así ni se intenta.
2. **URLs de redirección.** Authentication → URL Configuration con el dominio
   de producción, por si en el futuro vuelve algún enlace por correo.

## 4. Cuentas y contraseñas

Las cuentas las crea el super admin en Admin → Usuarios con nombre, correo,
teléfono, contraseña y rol, y se la dicta a la persona. Desde el menú de cada
usuario, "Definir contraseña" le pone una nueva: es la única recuperación que
hay (`admin_set_password`, migración 035). La persona la cambia después desde
su propio menú.

Las cuentas del equipo que nacieron con un correo provisional `.invalid` se
arreglan desde Editar: se les pone el correo real (`admin_change_email`,
migración 034) y una contraseña. La cuenta conserva su identificador, así que
su histórico, sus empresas y sus metas siguen donde estaban.

Si "Nuevo usuario" recibe un correo que ya tiene cuenta, no crea otra: la
saca de eliminados si hacía falta, actualiza nombre y teléfono y le pone la
contraseña.

## 3b. Comprobantes de pago

La migración 032 crea el bucket privado `comprobantes-pago` (imágenes o PDF,
hasta 5 MB). Cada archivo va en `<company_id>/pagos/<uuid>.<ext>` y su ruta
se guarda en `payments.voucher`; la aplicación firma una URL de una hora para
abrirlo. Con una venta a crédito el comprobante es obligatorio al registrar el
abono; de contado es opcional.

## 4. Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://yooqgcqdssvtkkschkku.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

No hay ninguna clave secreta: la aplicación entera habla con Supabase con la
clave publicable, acotada por RLS. La administración de cuentas —crear, cambiar
correo, poner clave temporal, bloquear el login— y la escritura de `audit_log`
las hacen funciones `security definer` de Postgres (`admin_create_user`,
`admin_change_email`, `admin_set_password`, `admin_ban_user`, `log_audit`)
que verifican `is_super_admin()` del lado de la base. La `service_role` no se
usa en ningún punto y no debe configurarse.

## 5. Avisos del linter que se dejan a propósito

`get_advisors` marca que los helpers de RLS (`is_super_admin`, `company_role`,
`has_company_access`, …) son ejecutables por `authenticated`. Es necesario:
Postgres verifica el permiso de EXECUTE también cuando la función se evalúa
dentro de una política, así que revocarlo rompería toda lectura. Lo que sí se
revocó es el acceso de `anon` y el de las funciones de trigger (migración 006).
