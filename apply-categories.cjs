const { Client } = require("pg");

const sql = `
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('Ingreso', 'Egreso')),
  created_at timestamptz not null default now(),
  unique (user_id, type, name)
);

create index if not exists categories_user_type_idx on public.categories(user_id, type);

alter table public.categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'categories_select_own'
  ) then
    create policy "categories_select_own"
    on public.categories for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'categories_insert_own'
  ) then
    create policy "categories_insert_own"
    on public.categories for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'categories_update_own'
  ) then
    create policy "categories_update_own"
    on public.categories for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'categories_delete_own'
  ) then
    create policy "categories_delete_own"
    on public.categories for delete
    using (auth.uid() = user_id);
  end if;
end $$;
`;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("categories listo");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
