create table if not exists public.whatsapp_message_logs (
  id uuid primary key default gen_random_uuid(),
  external_message_id text not null unique,
  from_phone text not null,
  body text not null,
  status text not null default 'received' check (status in ('received', 'created', 'ignored', 'failed')),
  movement_id uuid references public.movements(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_message_logs_created_at_idx on public.whatsapp_message_logs(created_at);

alter table public.whatsapp_message_logs enable row level security;

drop trigger if exists set_whatsapp_message_logs_updated_at on public.whatsapp_message_logs;
create trigger set_whatsapp_message_logs_updated_at
before update on public.whatsapp_message_logs
for each row execute function public.set_updated_at();
