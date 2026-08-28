alter table public.movements
  add column if not exists paid_responsibles text;

comment on column public.movements.paid_responsibles is
  'Lista JSON de responsables cuya parte del movimiento ya fue pagada.';
