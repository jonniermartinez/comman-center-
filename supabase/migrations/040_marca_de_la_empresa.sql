-- ============================================================
-- Command Center · 040 · La marca de la empresa
--
-- El logo ya estaba (009). Faltaban las otras dos cosas con las que una
-- oficina se presenta: su dominio y su WhatsApp.
--
-- El WhatsApp no es decorativo. Es el número por el que esa oficina atiende, y
-- tenerlo guardado es lo que permite que la aplicación abra el chat con un
-- cliente sin que nadie copie y pegue un número a mano.
-- ============================================================
alter table companies
  add column if not exists domain   text,
  add column if not exists whatsapp text;

comment on column companies.domain is
  'Dominio propio de la empresa, si tiene. Solo el nombre: autogo.com.co, sin https.';
comment on column companies.whatsapp is
  'WhatsApp de atención, en formato internacional y sin signos: 573001234567.';
