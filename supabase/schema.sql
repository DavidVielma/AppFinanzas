create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_base64 text,
  theme_mode text not null default 'light' check (theme_mode in ('light', 'dark')),
  created_at timestamptz not null default now()
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  flow text not null default 'Movimiento' check (flow in ('Movimiento', 'Transferencia', 'Pago Tarjeta')),
  account text not null default 'Principal',
  target_account text,
  type text not null check (type in ('Ingreso', 'Egreso')),
  category text not null,
  description text not null,
  amount numeric(14, 2) not null,
  status text not null default 'Proyectado' check (status in ('Confirmado', 'Proyectado', 'Pendiente')),
  responsible text,
  sort_order bigint,
  target_sort_order bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('principal', 'ahorro', 'tarjeta_credito')),
  color text not null default '#f8fafc',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.responsibles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('Ingreso', 'Egreso')),
  created_at timestamptz not null default now(),
  unique (user_id, type, name)
);

create index if not exists movements_user_period_idx on public.movements(user_id, year, month);
create index if not exists movements_user_category_idx on public.movements(user_id, category);
create index if not exists movements_user_account_idx on public.movements(user_id, account);
create index if not exists categories_user_type_idx on public.categories(user_id, type);

alter table public.profiles enable row level security;
alter table public.movements enable row level security;
alter table public.accounts enable row level security;
alter table public.responsibles enable row level security;
alter table public.categories enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "movements_select_own"
on public.movements for select
using (auth.uid() = user_id);

create policy "movements_insert_own"
on public.movements for insert
with check (auth.uid() = user_id);

create policy "movements_update_own"
on public.movements for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "movements_delete_own"
on public.movements for delete
using (auth.uid() = user_id);

create policy "accounts_select_own"
on public.accounts for select
using (auth.uid() = user_id);

create policy "accounts_insert_own"
on public.accounts for insert
with check (auth.uid() = user_id);

create policy "accounts_update_own"
on public.accounts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "accounts_delete_own"
on public.accounts for delete
using (auth.uid() = user_id);

create policy "responsibles_select_own"
on public.responsibles for select
using (auth.uid() = user_id);

create policy "responsibles_insert_own"
on public.responsibles for insert
with check (auth.uid() = user_id);

create policy "responsibles_update_own"
on public.responsibles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "responsibles_delete_own"
on public.responsibles for delete
using (auth.uid() = user_id);

create policy "categories_select_own"
on public.categories for select
using (auth.uid() = user_id);

create policy "categories_insert_own"
on public.categories for insert
with check (auth.uid() = user_id);

create policy "categories_update_own"
on public.categories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "categories_delete_own"
on public.categories for delete
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_movements_updated_at on public.movements;
create trigger set_movements_updated_at
before update on public.movements
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();
