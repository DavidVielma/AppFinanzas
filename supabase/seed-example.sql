-- Ejecutar este seed desde una sesion autenticada, por ejemplo adaptandolo a un script
-- con el access token del usuario. En el editor SQL de Supabase, auth.uid() sera null.
insert into public.movements (year, month, flow, account, target_account, type, category, description, amount, status)
values
  (2026, 4, 'Movimiento', 'Principal', null, 'Ingreso', 'Balance Anterior', 'Balance Anterior', 155653, 'Confirmado'),
  (2026, 4, 'Movimiento', 'Principal', null, 'Ingreso', 'Sueldo', 'Sueldo', 1450000, 'Confirmado'),
  (2026, 4, 'Movimiento', 'Tarjeta de Credito', null, 'Egreso', 'Supermercado', 'Supermercado tarjeta', -302559, 'Confirmado'),
  (2026, 4, 'Pago Tarjeta', 'Principal', 'Tarjeta de Credito', 'Egreso', 'Pago Tarjeta', 'Pago total tarjeta', -302559, 'Confirmado'),
  (2026, 4, 'Transferencia', 'Principal', 'Ahorro', 'Egreso', 'Ahorro', 'Transferencia a ahorro', -700000, 'Proyectado'),
  (2026, 5, 'Movimiento', 'Principal', null, 'Ingreso', 'Sueldo', 'Sueldo', 1450000, 'Proyectado'),
  (2026, 5, 'Movimiento', 'Tarjeta de Credito', null, 'Egreso', 'Supermercado', 'Supermercado mayo', -1077927, 'Proyectado'),
  (2026, 5, 'Movimiento', 'Tarjeta de Credito', null, 'Egreso', 'Viajes', 'Gastos del Viaje', -656874, 'Proyectado');
