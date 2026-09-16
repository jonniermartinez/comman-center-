-- ============================================================
-- Command Center · 049 · Las agendas no se escriben desde la aplicación
--
-- Nacen en Kommo y entran por las funciones `security definer` de 047; las
-- del Excel ya están cargadas. Quitar las políticas de escritura hace que la
-- regla viva en la base y no solo en que la pantalla no muestre el botón.
--
-- Va aparte de 047 a propósito: la versión publicada de la aplicación todavía
-- tiene "Nueva agenda". Se aplica junto con el despliegue que lo quita.
-- ============================================================

drop policy if exists appointments_insert on appointments;
drop policy if exists appointments_update on appointments;
drop policy if exists appointments_delete on appointments;
