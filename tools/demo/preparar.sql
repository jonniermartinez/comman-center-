-- Cuenta de super admin para grabar el demo. Es una cuenta de prueba
-- (e2e-…@jonnier.com): el cliente no la ve y purge_test_user la puede borrar.
-- Se corre como postgres (SQL Editor de Supabase), no desde la aplicación.
-- Cambia la contraseña antes de correrlo y ponla en tools/demo/demo.env.
do $$
begin
  -- Se firma como un super admin existente: admin_create_user exige uno.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from profiles where role = 'super_admin' and status = 'activo' limit 1), 'role', 'authenticated')::text, true);
  perform admin_create_user('e2e-demo-video@jonnier.com', 'Jonnier Martínez', 'super_admin', 'CAMBIAR-ESTA-CLAVE', null, true);
end $$;
