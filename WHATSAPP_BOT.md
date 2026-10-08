# Bot de WhatsApp Cloud API

Fluxa incluye un webhook para WhatsApp Cloud API en:

```text
https://app-financiera-lovat.vercel.app/api/whatsapp
```

## Variables de entorno

Configura estas variables en Vercel:

```text
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key_de_supabase
WHATSAPP_VERIFY_TOKEN=un_texto_secreto_para_verificar_el_webhook
WHATSAPP_ACCESS_TOKEN=token_permanente_o_temporal_de_meta
WHATSAPP_PHONE_NUMBER_ID=id_del_numero_en_meta
WHATSAPP_USER_ID=uuid_del_usuario_de_supabase_que_recibira_los_movimientos
WHATSAPP_ALLOWED_FROM=569XXXXXXXX
WHATSAPP_DEFAULT_ACCOUNT=Principal
WHATSAPP_DEFAULT_RESPONSIBLE=Tu nombre
```

`WHATSAPP_ALLOWED_FROM` es opcional. Para varios usuarios, lo recomendado es usar la tabla `whatsapp_user_links`; el bot buscara el telefono que escribe y guardara el movimiento en el usuario asociado.

## Base de datos

Ejecuta la migracion:

```text
supabase/migrations/20260525_whatsapp_bot.sql
supabase/migrations/20260526_whatsapp_user_links.sql
```

Estas crean:

- `whatsapp_message_logs`, para evitar movimientos duplicados si Meta reintenta el webhook.
- `whatsapp_user_links`, para asociar telefonos de WhatsApp con usuarios de Fluxa.

## Agregar usuarios al bot

Cada usuario necesita tener cuenta en Fluxa/Supabase. Luego agrega su telefono en formato internacional, sin `+`, espacios ni guiones:

```sql
insert into public.whatsapp_user_links (phone, user_id, default_account, responsible, active)
values (
  '569XXXXXXXX',
  'uuid-del-usuario-en-supabase',
  'Principal',
  'Nombre',
  true
)
on conflict (phone) do update
set user_id = excluded.user_id,
    default_account = excluded.default_account,
    responsible = excluded.responsible,
    active = excluded.active,
    updated_at = now();
```

Si el usuario escribe desde un numero no registrado, el bot respondera que debe ser agregado por el administrador.

## Configuracion en Meta

1. En Meta for Developers crea o abre una app con WhatsApp.
2. En WhatsApp > API Setup copia:
   - `Phone number ID` para `WHATSAPP_PHONE_NUMBER_ID`.
   - Access token para `WHATSAPP_ACCESS_TOKEN`.
3. En WhatsApp > Configuration > Webhook configura:
   - Callback URL: `https://app-financiera-lovat.vercel.app/api/whatsapp`
   - Verify token: el mismo valor de `WHATSAPP_VERIFY_TOKEN`.
4. Suscribe el webhook al campo `messages`.
5. Despliega nuevamente en Vercel despues de guardar variables.

## Formatos aceptados

```text
20000 farmacia
2690 mc furry
ingreso 50000 pago cliente
abono 12000 reembolso
```

Por defecto se registra como gasto confirmado en la cuenta `Principal`. Usa `ingreso` o `abono` al inicio para registrar montos positivos.

## Respuesta esperada

```text
Agregue gasto de $20.000 por 'farmacia'.
Categoria: Salud
Cuenta: Principal
```
