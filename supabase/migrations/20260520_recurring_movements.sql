create table if not exists public.recurring_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  flow text not null default 'Movimiento' check (flow in ('Movimiento', 'Transferencia', 'Pago Tarjeta')),
  account text not null default 'Principal',
  target_account text,
  type text not null check (type in ('Ingreso', 'Egreso')),
  category text not null,
  description text not null,
  amount numeric(14, 2) not null,
  status text not null default 'Proyectado' check (status in ('Confirmado', 'Proyectado', 'Pendiente')),
  responsible text,
  start_year integer not null check (start_year between 2000 and 2100),
  start_month integer not null check (start_month between 1 and 12),
  frequency text not null check (frequency in ('monthly', 'bimonthly', 'quarterly', 'yearly')),
  occurrence_count integer not null default 12 check (occurrence_count between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.movements
  add column if not exists recurring_id uuid,
  add column if not exists recurring_occurrence integer,
  add column if not exists recurring_modified boolean not null default false;

alter table public.movements
  drop constraint if exists movements_recurring_id_fkey,
  add constraint movements_recurring_id_fkey
    foreign key (recurring_id) references public.recurring_movements(id) on delete set null;

create index if not exists movements_user_recurring_idx on public.movements(user_id, recurring_id);
create index if not exists recurring_movements_user_active_idx on public.recurring_movements(user_id, active);

alter table public.recurring_movements enable row level security;

drop policy if exists "recurring_movements_select_own" on public.recurring_movements;
create policy "recurring_movements_select_own"
on public.recurring_movements for select
using (auth.uid() = user_id);

drop policy if exists "recurring_movements_insert_own" on public.recurring_movements;
create policy "recurring_movements_insert_own"
on public.recurring_movements for insert
with check (auth.uid() = user_id);

drop policy if exists "recurring_movements_update_own" on public.recurring_movements;
create policy "recurring_movements_update_own"
on public.recurring_movements for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "recurring_movements_delete_own" on public.recurring_movements;
create policy "recurring_movements_delete_own"
on public.recurring_movements for delete
using (auth.uid() = user_id);

drop trigger if exists set_recurring_movements_updated_at on public.recurring_movements;
create trigger set_recurring_movements_updated_at
before update on public.recurring_movements
for each row execute function public.set_updated_at();
