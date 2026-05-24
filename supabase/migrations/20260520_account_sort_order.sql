alter table public.accounts
add column if not exists sort_order integer not null default 0;

with ordered_accounts as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at asc, name asc
    ) - 1 as next_sort_order
  from public.accounts
)
update public.accounts accounts
set sort_order = ordered_accounts.next_sort_order
from ordered_accounts
where accounts.id = ordered_accounts.id
  and accounts.sort_order = 0;
