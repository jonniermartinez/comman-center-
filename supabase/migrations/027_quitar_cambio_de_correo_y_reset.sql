-- ============================================================
-- Fuera cambiar el correo y restablecer la contrasena desde la aplicacion.
--
-- Las dos vivian en el menu de cada usuario y existian por el mismo motivo: las
-- cuentas del equipo se crean con un correo provisional que no recibe nada, asi
-- que no podian usar "olvide mi contrasena" ni actualizar su direccion solas.
--
-- Se retiran a peticion del producto. Con ellas se van sus funciones: dejarlas
-- en la base seria mantener viva la capacidad de cambiarle el correo o la clave
-- a cualquiera sin que nada en la aplicacion lo ofrezca ni lo registre, que es
-- justo el tipo de puerta que no conviene tener abierta.
--
-- `admin_create_user` se queda y sigue admitiendo contrasena: es lo que usa el
-- alta del equipo de una empresa. Y quien tenga un correo real sigue teniendo
-- "olvide mi contrasena", que no pasa por aqui.
-- ============================================================
drop function if exists admin_change_email(uuid, text);
drop function if exists admin_set_password(uuid, text);
