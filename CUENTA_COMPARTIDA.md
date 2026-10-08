# Cuenta compartida (vista de solo lectura)

Permite mostrar los movimientos de **una cuenta** (por ejemplo `Ahorro Matrimonio`) a personas sin usuario en la app,
por ejemplo incrustando la pagina en Notion.

```text
https://app-financiera-lovat.vercel.app/cuenta-compartida?clave=CLAVE
```

La pagina muestra, mes a mes:

- Saldo al inicio del mes, ingresos, egresos, neto del mes y saldo acumulado.
- La lista de movimientos del mes con su estado (`Confirmado`, `Proyectado`, `Pendiente`).
- Flechas para cambiar de mes.

Las transferencias hacia la cuenta se muestran como ingresos ("Desde Principal") y los saldos se calculan igual que en la app.

## Parametros

| Parametro | Obligatorio | Ejemplo | Uso |
| --- | --- | --- | --- |
| `clave` | Si | `clave=abc...` | Clave secreta que da acceso a la cuenta. |
| `year` / `month` | No | `year=2026&month=10` | Mes inicial. Por defecto, el mes actual. |
| `tema` | No | `tema=oscuro` | `claro` u `oscuro`. Por defecto sigue el tema del sistema. |

## Configuracion

1. Aplica la migracion `supabase/migrations/20261008_shared_account_views.sql` (editor SQL de Supabase o `DATABASE_URL=... node apply-shared-account-views.cjs`).
2. Crea una clave para la cuenta (minimo 24 caracteres):

```sql
insert into public.shared_account_views (token, user_id, account, title)
values (
  'CLAVE_LARGA_Y_ALEATORIA',
  (select user_id from public.accounts where name = 'Ahorro Matrimonio'),
  'Ahorro Matrimonio',
  'Ahorro Matrimonio'
);
```

3. En Notion: `/embed` y pega la URL con la clave.

Para quitar el acceso: `update public.shared_account_views set active = false where token = '...';`

## Seguridad

- La clave solo da lectura de esa cuenta; no expone otras cuentas ni permite editar.
- La tabla `shared_account_views` tiene RLS sin politicas: solo se consulta desde la funcion `get_shared_account_ledger`.
- Cualquiera con el enlace completo puede ver la cuenta. No publiques la clave en el repositorio.
