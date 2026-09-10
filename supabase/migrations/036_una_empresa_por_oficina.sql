-- Una empresa por oficina.
--
-- El importador agrupó las dieciséis oficinas en cinco "empresas" —LV, CEA,
-- Trámites, TTC y Ruta Segura— que salieron del prefijo del nombre de archivo
-- y no existen en la realidad. Cada oficina es una empresa, con su ciudad y su
-- equipo, y son estas:
--
--   Tuluá · CEA la 28          Buga · Ruta Segura       Cerrito · Cevial
--   Jamundí · TTC              Yumbo · Atenas           Trámites Candelaria
--   Pereira · Eduvial          Palmira · San José       Trámites Florida
--   La Unión · Autogo          Trámites Buenaventura    Cali · Carss
--   Cartago · Ruta Maestra
--
-- La confusión venía de leer la columna "Escuela" como si fuera el dueño de la
-- venta. No lo es: es dónde va a estudiar el alumno. Trámites Florida vende
-- cursos de CEA la 28 (265) y de TTC (78) sin ser ninguna de las dos, y Yumbo
-- y Palmira venden TTC entero. Que en Tuluá casi todo diga "CEA la 28" y en
-- Cartago "Ruta Maestra" es lo que confirma el mapa de arriba, no lo que lo
-- contradice.
--
-- No se mueve ni una fila de venta de sede: cada sede se reengancha a su
-- empresa nueva y company_id se propaga desde la sede, que es de donde
-- siempre debió salir.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 1. Doce oficinas que ya eran una sede pasan a ser empresa.
--
-- La sede conserva su id, así que ventas, pagos, jornadas, caja y agendas
-- siguen colgando de ella sin tocarse.
-- ------------------------------------------------------------
do $$
declare
  m     record;
  nueva uuid;
  vieja uuid;
begin
  for m in
    select * from (values
      ('lv',          'Sede Tuluá',        'CEA la 28',             'cea-la-28',             'Tuluá',        'Valle del Cauca', '#b45309'),
      ('ttc',         'Sede principal',    'TTC',                   'ttc',                   'Jamundí',      'Valle del Cauca', '#7c3aed'),
      ('cea',         'Sede Eduvial',      'Eduvial',               'eduvial',               'Pereira',      'Risaralda',       '#0891b2'),
      ('lv',          'Sede La Unión',     'Autogo',                'autogo',                'La Unión',     'Valle del Cauca', '#1d4ed8'),
      ('tramites',    'Sede Cartago',      'Ruta Maestra',          'ruta-maestra',          'Cartago',      'Valle del Cauca', '#0f766e'),
      ('ruta-segura', 'Sede principal',    'Ruta Segura',           'ruta-segura',           'Buga',         'Valle del Cauca', '#be123c'),
      ('lv',          'Sede Yumbo',        'Atenas',                'atenas',                'Yumbo',        'Valle del Cauca', '#ca8a04'),
      ('lv',          'Sede Palmira',      'San José',              'san-jose',              'Palmira',      'Valle del Cauca', '#4d7c0f'),
      ('lv',          'Sede Buenaventura', 'Trámites Buenaventura', 'tramites-buenaventura', 'Buenaventura', 'Valle del Cauca', '#0369a1'),
      ('cea',         'Sede Cevial',       'Cevial',                'cevial',                'El Cerrito',   'Valle del Cauca', '#9333ea'),
      ('tramites',    'Sede Candelaria',   'Trámites Candelaria',   'tramites-candelaria',   'Candelaria',   'Valle del Cauca', '#c2410c'),
      ('tramites',    'Sede Florida',      'Trámites Florida',      'tramites-florida',      'Florida',      'Valle del Cauca', '#059669')
    ) as t(slug_viejo, sede_vieja, nombre, slug, ciudad, departamento, color)
  loop
    select id into vieja from companies where slug = m.slug_viejo;
    if vieja is null then
      raise exception 'No existe la empresa de origen %', m.slug_viejo;
    end if;

    -- TTC y Ruta Segura ya eran una sola oficina: se corrigen en su sitio.
    select id into nueva from companies where slug = m.slug;
    if nueva is null then
      insert into companies (name, slug, city, department, accent_color, crm_label)
           values (m.nombre, m.slug, m.ciudad, m.departamento, m.color, m.nombre)
        returning id into nueva;
    else
      update companies
         set name = m.nombre, city = m.ciudad, department = m.departamento,
             accent_color = m.color, crm_label = m.nombre
       where id = nueva;
    end if;

    update branches
       set company_id = nueva, name = 'Sede principal', city = m.ciudad,
           department = m.departamento, is_primary = true
     where company_id = vieja and name = m.sede_vieja;

    if not found then
      raise exception 'No existe la sede % en %', m.sede_vieja, m.slug_viejo;
    end if;
  end loop;
end $$;


-- ------------------------------------------------------------
-- 2. Cali.
--
-- Legendarios, Monarcas y Sultanes no son empresas ni sedes: son equipos
-- comerciales, y la misma gente aparece en varios —Arias Ingrid y Acevedo
-- Nataly venden en dos, Prado Mariana en los tres—. La empresa es Carss y sus
-- sedes son las dos escuelas: Conducars y Champions Car.
--
-- De las 588 ventas solo 106 dicen a cuál de las dos fueron. Hasta junio de
-- 2026 la columna Escuela decía "Cars" a secas y ninguna otra columna
-- —contrato, voucher, examen, centro médico, financiación— las distingue. Esas
-- 482 no se reparten a ojo: quedan en la empresa, en una sede "Sin definir"
-- que no es ninguna de las dos. El equipo del que salió cada fila sigue
-- guardado en source_file.
-- ------------------------------------------------------------
do $$
declare
  cea    uuid;
  carss  uuid;
  equipo uuid[];
begin
  select id into cea from companies where slug = 'cea';
  select array_agg(id) into equipo
    from branches where company_id = cea and name like 'Carss %';

  if equipo is null then
    raise exception 'No están las sedes de equipo de Carss bajo CEA';
  end if;

  insert into companies (name, slug, city, department, accent_color, crm_label)
       values ('Carss', 'carss', 'Cali', 'Valle del Cauca', '#db2777', 'Carss')
  on conflict (slug) do update set city = excluded.city
    returning id into carss;

  insert into branches (company_id, name, city, department, is_primary)
       values (carss, 'Conducars',     'Cali', 'Valle del Cauca', true),
              (carss, 'Champions Car', 'Cali', 'Valle del Cauca', false),
              (carss, 'Sin definir',   'Cali', 'Valle del Cauca', false)
  on conflict (company_id, name) do nothing;

  -- Cada venta a la escuela que diga el Excel; el resto a "Sin definir".
  update sales s
     set company_id = carss,
         branch_id  = (select b.id from branches b
                        where b.company_id = carss
                          and b.name = case s.school_code
                                         when 'conducars' then 'Conducars'
                                         when 'champions' then 'Champions Car'
                                         else 'Sin definir'
                                       end)
   where s.branch_id = any(equipo);

  -- El pago va donde quedó su venta. Los cinco que nunca enlazaron con una,
  -- a "Sin definir".
  update payments p
     set company_id = s.company_id, branch_id = s.branch_id
    from sales s
   where s.id = p.sale_id and p.branch_id = any(equipo);

  update payments p
     set company_id = carss,
         branch_id  = (select id from branches
                        where company_id = carss and name = 'Sin definir')
   where p.branch_id = any(equipo);

  -- Veintisiete veces la misma persona reportó el mismo día en dos hojas de
  -- equipo. Al caer todas en la misma sede chocarían contra la clave
  -- (empresa, sede, fecha, persona), así que se juntan en una sola jornada:
  -- llamadas, agendas y atenciones son cosas que se hicieron y se suman; las
  -- colas del CRM —chats, tareas, caducadas— son una foto de ese momento y no
  -- un acumulado, así que se toma la mayor. En 19 de los 27 casos las dos
  -- filas traían trabajo real, y sumar es lo único que no lo tira.
  with equipos as (
    select * from daily_activity where branch_id = any(equipo)
  ),
  grupos as (
    select report_date, staff_id,
           (array_agg(id order by
              chats_inicial + chats_medio + chats_final
            + tareas_inicial + tareas_medio + tareas_final
            + caducadas_inicial + caducadas_medio + caducadas_final
            + agenda_confirmada + agenda_posible + agenda_reprograma
            + agenda_no_contesta + agenda_cancela
            + llamada_no_contestada + llamada_efectiva + llamada_seguimiento
            + llamada_agenda + llamada_no_interesado + llamada_contestada
            + llamada_postventa
            + atencion_venta + atencion_seguimiento + atencion_declinado
            + atencion_asociado + atencion_enrolamiento + atencion_certificados
            + atencion_agenda + atencion_renovacion desc, id))[1] as queda
      from equipos
     group by report_date, staff_id
    having count(*) > 1
  ),
  juntas as (
    select g.queda,
           min(e.hora_llegada)            as hora_llegada,
           max(e.hora_salida)             as hora_salida,
           max(e.chats_inicial)           as chats_inicial,
           max(e.chats_medio)             as chats_medio,
           max(e.chats_final)             as chats_final,
           max(e.tareas_inicial)          as tareas_inicial,
           max(e.tareas_medio)            as tareas_medio,
           max(e.tareas_final)            as tareas_final,
           max(e.caducadas_inicial)       as caducadas_inicial,
           max(e.caducadas_medio)         as caducadas_medio,
           max(e.caducadas_final)         as caducadas_final,
           sum(e.agenda_confirmada)       as agenda_confirmada,
           sum(e.agenda_posible)          as agenda_posible,
           sum(e.agenda_reprograma)       as agenda_reprograma,
           sum(e.agenda_no_contesta)      as agenda_no_contesta,
           sum(e.agenda_cancela)          as agenda_cancela,
           sum(e.llamada_no_contestada)   as llamada_no_contestada,
           sum(e.llamada_efectiva)        as llamada_efectiva,
           sum(e.llamada_seguimiento)     as llamada_seguimiento,
           sum(e.llamada_agenda)          as llamada_agenda,
           sum(e.llamada_no_interesado)   as llamada_no_interesado,
           sum(e.llamada_contestada)      as llamada_contestada,
           sum(e.llamada_postventa)       as llamada_postventa,
           sum(e.atencion_venta)          as atencion_venta,
           sum(e.atencion_seguimiento)    as atencion_seguimiento,
           sum(e.atencion_declinado)      as atencion_declinado,
           sum(e.atencion_asociado)       as atencion_asociado,
           sum(e.atencion_enrolamiento)   as atencion_enrolamiento,
           sum(e.atencion_certificados)   as atencion_certificados,
           sum(e.atencion_agenda)         as atencion_agenda,
           sum(e.atencion_renovacion)     as atencion_renovacion
      from grupos g
      join equipos e
        on e.report_date = g.report_date
       and e.staff_id is not distinct from g.staff_id
     group by g.queda
  ),
  fusionadas as (
    update daily_activity d
       set hora_llegada          = j.hora_llegada,
           hora_salida           = j.hora_salida,
           chats_inicial         = j.chats_inicial,
           chats_medio           = j.chats_medio,
           chats_final           = j.chats_final,
           tareas_inicial        = j.tareas_inicial,
           tareas_medio          = j.tareas_medio,
           tareas_final          = j.tareas_final,
           caducadas_inicial     = j.caducadas_inicial,
           caducadas_medio       = j.caducadas_medio,
           caducadas_final       = j.caducadas_final,
           agenda_confirmada     = j.agenda_confirmada,
           agenda_posible        = j.agenda_posible,
           agenda_reprograma     = j.agenda_reprograma,
           agenda_no_contesta    = j.agenda_no_contesta,
           agenda_cancela        = j.agenda_cancela,
           llamada_no_contestada = j.llamada_no_contestada,
           llamada_efectiva      = j.llamada_efectiva,
           llamada_seguimiento   = j.llamada_seguimiento,
           llamada_agenda        = j.llamada_agenda,
           llamada_no_interesado = j.llamada_no_interesado,
           llamada_contestada    = j.llamada_contestada,
           llamada_postventa     = j.llamada_postventa,
           atencion_venta        = j.atencion_venta,
           atencion_seguimiento  = j.atencion_seguimiento,
           atencion_declinado    = j.atencion_declinado,
           atencion_asociado     = j.atencion_asociado,
           atencion_enrolamiento = j.atencion_enrolamiento,
           atencion_certificados = j.atencion_certificados,
           atencion_agenda       = j.atencion_agenda,
           atencion_renovacion   = j.atencion_renovacion
      from juntas j
     where d.id = j.queda
    returning d.id
  )
  delete from daily_activity d
   using equipos e, grupos g
   where d.id = e.id
     and e.report_date = g.report_date
     and e.staff_id is not distinct from g.staff_id
     and d.id <> g.queda;

  -- Las jornadas son de la persona, no de la escuela: todas a "Sin definir".
  update daily_activity d
     set company_id = carss,
         branch_id  = (select id from branches
                        where company_id = carss and name = 'Sin definir')
   where d.branch_id = any(equipo);

  update company_users u
     set company_id = carss,
         branch_id  = (select id from branches
                        where company_id = carss and name = 'Sin definir')
   where u.branch_id = any(equipo);

  update company_staff cs
     set company_id = carss,
         branch_id  = (select id from branches
                        where company_id = carss and name = 'Sin definir')
   where cs.branch_id = any(equipo);

  delete from branches where id = any(equipo);
end $$;


-- ------------------------------------------------------------
-- 3. Propagar la empresa desde la sede.
--
-- Ninguna fila cambia de sede, así que basta con hacer que company_id diga lo
-- que su sede ya dice.
-- ------------------------------------------------------------
update sales s          set company_id = b.company_id from branches b where b.id = s.branch_id  and s.company_id <> b.company_id;
update payments p       set company_id = b.company_id from branches b where b.id = p.branch_id  and p.company_id <> b.company_id;
update daily_activity d set company_id = b.company_id from branches b where b.id = d.branch_id  and d.company_id <> b.company_id;
update cash_movements m set company_id = b.company_id from branches b where b.id = m.branch_id  and m.company_id <> b.company_id;
update appointments a   set company_id = b.company_id from branches b where b.id = a.branch_id  and a.company_id <> b.company_id;
update company_users u  set company_id = b.company_id from branches b where b.id = u.branch_id  and u.company_id <> b.company_id;
update company_staff cs set company_id = b.company_id from branches b where b.id = cs.branch_id and cs.company_id <> b.company_id;


-- ------------------------------------------------------------
-- 4. Módulos.
--
-- Las empresas nuevas nacen con todo habilitado, como las traía el importador.
-- ------------------------------------------------------------
insert into company_modules (company_id, module_code)
select c.id, m.code
  from companies c cross join modules m
 where c.slug in ('cea-la-28', 'ttc', 'eduvial', 'autogo', 'ruta-maestra', 'ruta-segura',
                  'atenas', 'san-jose', 'tramites-buenaventura', 'cevial',
                  'tramites-candelaria', 'tramites-florida', 'carss')
on conflict (company_id, module_code) do nothing;


-- ------------------------------------------------------------
-- 5. Archivar las tres cáscaras.
--
-- LV, CEA y Trámites quedan sin sedes, sin datos y sin gente. Nunca fueron
-- empresas, pero se archivan en vez de borrarse: la auditoría las referencia.
-- ------------------------------------------------------------
update companies
   set status = 'archivada', archived_at = now()
 where slug in ('lv', 'cea', 'tramites') and archived_at is null;
