create table if not exists public.whatsapp_user_links (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  default_account text not null default 'Principal',
  responsible text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_user_links_user_id_idx on public.whatsapp_user_links(user_id);

alter table public.whatsapp_user_links enable row level security;

drop trigger if exists set_whatsapp_user_links_updated_at on public.whatsapp_user_links;
create trigger set_whatsapp_user_links_updated_at
before update on public.whatsapp_user_links
for each row execute function public.set_updated_at();
