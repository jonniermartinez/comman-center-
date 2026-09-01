-- El upsert de metas siempre fallaba con "there is no unique or exclusion
-- constraint matching the ON CONFLICT specification": el indice unico estaba
-- sobre coalesce(user_id, ...) y Postgres no infiere un indice de expresion
-- desde on conflict (company_id, period_month, metric_code, user_id).
--
-- Con nulls not distinct el indice va sobre las columnas tal cual —asi el
-- on conflict lo encuentra— y las metas de empresa (user_id null) siguen
-- siendo una sola por metrica y mes.

drop index if exists objectives_unica_idx;

create unique index objectives_unica_idx
  on objectives (company_id, period_month, metric_code, user_id)
  nulls not distinct;
