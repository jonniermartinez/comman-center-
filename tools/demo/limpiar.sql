-- Deshace lo que deja la grabación: la empresa "Demo Buga" con todo lo capturado
-- dentro, la comercial de ejemplo y la cuenta de prueba. Nada más.
do $$
declare emp record; cuenta uuid;
begin
  select id into cuenta from profiles where email = 'e2e-demo-video@jonnier.com';
  perform set_config('request.jwt.claims', json_build_object('sub', cuenta, 'role', 'authenticated')::text, true);
  for emp in select id, name from companies where slug = 'demo-buga' loop
    perform delete_company_cascade(emp.id, emp.name);
  end loop;
  delete from company_staff where staff_id in (select id from staff where full_name = 'Gómez Laura');
  delete from staff where full_name = 'Gómez Laura';
  if cuenta is not null then perform purge_test_user(cuenta); end if;
end $$;
