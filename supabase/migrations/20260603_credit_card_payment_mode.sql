alter table public.movements
  add column if not exists card_payment_mode text;

alter table public.movements
  drop constraint if exists movements_card_payment_mode_check;

alter table public.movements
  add constraint movements_card_payment_mode_check
    check (card_payment_mode in ('auto', 'manual'));

update public.movements
set card_payment_mode = 'auto'
where flow = 'Pago Tarjeta'
  and card_payment_mode is null;
