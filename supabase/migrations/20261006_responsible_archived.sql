alter table public.responsibles
add column if not exists archived boolean not null default false;
