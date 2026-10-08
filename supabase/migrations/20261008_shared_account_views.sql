-- Vistas publicas de solo lectura de una cuenta (por ejemplo para incrustar en Notion).
-- Cada fila entrega acceso a UNA cuenta de UN usuario mediante una clave secreta.
-- La tabla no tiene politicas: solo se lee a traves de la funcion security definer.

create table if not exists public.shared_account_views (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) >= 24),
  user_id uuid not null references auth.users(id) on delete cascade,
  account text not null,
  title text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.shared_account_views enable row level security;

create or replace function public.get_shared_account_ledger(p_token text, p_year integer, p_month integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_view public.shared_account_views;
  v_period integer := p_year * 12 + p_month;
  v_opening numeric := 0;
  v_rows jsonb;
  v_first integer;
  v_last integer;
begin
  if p_month < 1 or p_month > 12 then
    raise exception 'Mes invalido';
  end if;

  select * into v_view
  from public.shared_account_views
  where token = p_token and active;

  if not found then
    raise exception 'Clave invalida';
  end if;

  -- Cada movimiento afecta la cuenta igual que en la app: monto propio si es la cuenta origen,
  -- y valor absoluto si es la cuenta destino de una transferencia o pago de tarjeta.
  with ledger as (
    select
      m.*,
      case
        when m.account = v_view.account then m.amount
        else abs(m.amount)
      end as account_amount,
      m.account <> v_view.account as incoming_transfer
    from public.movements m
    where m.user_id = v_view.user_id
      and (
        m.account = v_view.account
        or (m.target_account = v_view.account and m.flow in ('Transferencia', 'Pago Tarjeta'))
      )
  )
  select
    coalesce(sum(account_amount) filter (where year * 12 + month < v_period), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'flow', flow,
          'category', category,
          'description', description,
          'amount', account_amount,
          'status', status,
          'responsible', responsible,
          'counterpart', case when incoming_transfer then account else target_account end,
          'created_at', created_at
        )
        order by sort_order nulls last, created_at, id
      ) filter (where year * 12 + month = v_period),
      '[]'::jsonb
    ),
    min(year * 12 + month - 1),
    max(year * 12 + month - 1)
  into v_opening, v_rows, v_first, v_last
  from ledger;

  return jsonb_build_object(
    'account', v_view.account,
    'title', coalesce(v_view.title, v_view.account),
    'year', p_year,
    'month', p_month,
    'opening', v_opening,
    'movements', v_rows,
    'first_period', case when v_first is null then null else jsonb_build_object('year', v_first / 12, 'month', v_first % 12 + 1) end,
    'last_period', case when v_last is null then null else jsonb_build_object('year', v_last / 12, 'month', v_last % 12 + 1) end
  );
end;
$$;

revoke all on function public.get_shared_account_ledger(text, integer, integer) from public;
grant execute on function public.get_shared_account_ledger(text, integer, integer) to anon, authenticated;
