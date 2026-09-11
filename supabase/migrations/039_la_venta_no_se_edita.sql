-- ============================================================
-- Command Center · 039 · Una venta registrada no se edita
--
-- Hasta la 025 cualquiera de la empresa podía corregir la venta de un
-- compañero, y el argumento era bueno: el error se arregla en el punto sin
-- esperar a un coordinador. Para una jornada o una agenda sigue valiendo.
--
-- Para una venta, no. Una venta es plata: valor, bonos, financiación y saldo,
-- y contra ella se liquidan comisiones y se concilia cartera. Que siga abierta
-- después de guardada convierte cada cifra en provisional y borra la frontera
-- entre corregir un dedazo y cambiar el número. Desde acá la venta se firma al
-- guardarla: si hay que tocarla, la toca quien administra la plataforma, y la
-- auditoría guarda qué cambió.
--
-- Lo que NO cambia: registrar una venta sigue pudiéndolo hacer cualquier
-- comercial de la empresa, y borrar sigue como en la 024 —lo suyo, o quien
-- administra la empresa—.
-- ============================================================
drop policy if exists sales_update on sales;

create policy sales_update on sales
  for update
  using (is_super_admin())
  with check (is_super_admin());

-- Las agendas y las jornadas se quedan como estaban: corregir lo de un
-- compañero ahí no mueve dinero.
