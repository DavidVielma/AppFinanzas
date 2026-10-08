-- Enlaza las compras en cuotas antiguas (creadas antes de que las cuotas se guardaran
-- como serie) con una regla en recurring_movements, igual que las cuotas nuevas.
--
-- Una serie antigua se reconoce por: mismo usuario, misma cuenta, misma descripcion base
-- (sin el sufijo "(n/N)"), mismo total de cuotas N y meses consecutivos (la cuota n cae
-- n-1 meses despues de la cuota 1). Solo se enlazan grupos con al menos 2 cuotas y sin
-- numeros de cuota repetidos; los casos ambiguos quedan como estaban.
--
-- Es idempotente: solo toca movimientos que aun no tienen recurring_id.
-- Para revisar antes de aplicar, ejecuta solo el bloque "Vista previa" del final.

begin;

create temp table legacy_installments on commit drop as
select
  m.id,
  m.user_id,
  m.account,
  m.year,
  m.month,
  trim(regexp_replace(m.description, '\s*\((\d+)/(\d+)\)\s*$', '')) as base,
  (regexp_match(m.description, '\((\d+)/(\d+)\)\s*$'))[1]::int as idx,
  (regexp_match(m.description, '\((\d+)/(\d+)\)\s*$'))[2]::int as total
from public.movements m
where m.recurring_id is null
  and m.reimbursement_source_id is null
  and m.flow = 'Movimiento'
  and m.description ~ '\(\d+/\d+\)\s*$';

alter table legacy_installments add column anchor integer;
update legacy_installments set anchor = (year * 12 + month - 1) - idx;

create temp table legacy_groups on commit drop as
select
  gen_random_uuid() as rule_id,
  user_id,
  account,
  lower(base) as base_key,
  total,
  anchor
from legacy_installments
where idx between 1 and total
  and total between 2 and 120
group by user_id, account, lower(base), total, anchor
having count(*) >= 2 and count(*) = count(distinct idx);

create temp table legacy_links on commit drop as
select li.id, li.idx, li.base, g.rule_id, g.user_id, g.total, g.anchor
from legacy_installments li
join legacy_groups g
  on g.user_id = li.user_id
 and g.account = li.account
 and g.base_key = lower(li.base)
 and g.total = li.total
 and g.anchor = li.anchor;

-- La regla toma los datos de la primera cuota disponible de cada serie.
insert into public.recurring_movements (
  id, user_id, flow, account, target_account, type, category, description, amount,
  status, responsible, start_year, start_month, frequency, occurrence_count, active
)
select distinct on (l.rule_id)
  l.rule_id,
  l.user_id,
  'Movimiento',
  m.account,
  null,
  m.type,
  m.category,
  l.base,
  m.amount,
  m.status,
  m.responsible,
  (l.anchor + 1) / 12,
  ((l.anchor + 1) % 12) + 1,
  'monthly',
  l.total,
  true
from legacy_links l
join public.movements m on m.id = l.id
order by l.rule_id, l.idx;

update public.movements m
set recurring_id = l.rule_id,
    recurring_occurrence = l.idx
from legacy_links l
where m.id = l.id;

select
  (select count(*) from legacy_groups) as series_enlazadas,
  (select count(*) from legacy_links) as cuotas_enlazadas,
  (select count(*) from legacy_installments) - (select count(*) from legacy_links) as cuotas_sin_enlazar;

commit;

-- Vista previa (no modifica nada): ejecutar por separado para revisar las series que
-- se enlazarian y las cuotas que quedarian fuera.
--
-- with li as (
--   select m.id, m.user_id, m.account, m.description, m.year, m.month,
--     lower(trim(regexp_replace(m.description, '\s*\((\d+)/(\d+)\)\s*$', ''))) as base_key,
--     (regexp_match(m.description, '\((\d+)/(\d+)\)\s*$'))[1]::int as idx,
--     (regexp_match(m.description, '\((\d+)/(\d+)\)\s*$'))[2]::int as total
--   from public.movements m
--   where m.recurring_id is null and m.reimbursement_source_id is null
--     and m.flow = 'Movimiento' and m.description ~ '\(\d+/\d+\)\s*$'
-- )
-- select account, base_key, total, count(*) as cuotas, count(distinct idx) as numeros_distintos,
--   min(year * 100 + month) as desde, max(year * 100 + month) as hasta
-- from li
-- group by user_id, account, base_key, total, (year * 12 + month - 1) - idx
-- order by desde;
