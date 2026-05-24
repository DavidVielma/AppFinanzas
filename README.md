# App Financiera Familiar

Aplicacion React + Vite para administrar finanzas personales o familiares con una estructura inspirada en la hoja `Flujo` del Excel: meses, ingresos, egresos, categorias, descripcion, monto, estados y balances mensual/anual.

## Funciones

- Sesiones con Supabase Auth usando usuario + contraseña.
- Modo demo local si aun no configuraste Supabase.
- Movimientos mensuales con `Ingreso` o `Egreso`.
- Categoria, descripcion, monto y estado: `Confirmado`, `Proyectado`, `Pendiente`.
- Balance mensual, balance anual, ingresos, egresos y resumen por categoria.
- Vista anual por meses similar al flujo de la planilla.
- Exportacion CSV.

## Instalacion

Necesitas Node.js instalado. Luego, desde esta carpeta:

```bash
npm install
npm run dev
```

Abre la URL que entregue Vite, normalmente `http://localhost:5173`.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. En el editor SQL de Supabase, ejecuta `supabase/schema.sql`.
3. Copia `.env.example` como `.env`.
4. Completa:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_SITE_URL=http://localhost:5173
```

5. Reinicia Vite con `npm run dev`.

Si quieres iniciar sesion solo con nombre de usuario, la app genera internamente un email tecnico `usuario@finanzas.local`. En Supabase conviene desactivar la confirmacion obligatoria de email o usar un email real en el formulario.

### Recuperacion de contraseña

En Supabase, revisa `Authentication > URL Configuration`:

- `Site URL`: usa la URL real donde corre la app. En local puede ser `http://localhost:5173`; en red o servidor debe ser la URL publica o de tu LAN, por ejemplo `http://192.168.1.50:5173`.
- `Redirect URLs`: agrega la misma URL y, si publicas en produccion, tambien el dominio final.

Si el correo de recuperacion abre `localhost` y ves `ERR_CONNECTION_REFUSED`, significa que el navegador esta intentando volver a tu propia maquina y no al servidor donde corre la app, o que Vite no esta levantado en ese puerto.

### Proveedor SMTP y plantillas HTML

La alerta de Supabase se resuelve configurando un proveedor SMTP propio en `Authentication > SMTP Settings`. Puedes usar Brevo, Resend, SendGrid, Mailgun u otro proveedor transaccional; Supabase seguira generando los enlaces seguros de Auth, pero el envio saldra desde tu remitente.

El repo incluye plantillas formales listas para pegar en `supabase/email-templates/`:

- `confirm-signup.html` para confirmacion de cuenta.
- `reset-password.html` para recuperacion de contrasena.
- `invite-user.html` para invitaciones.

Revisa `supabase/email-templates/README.md` para los pasos de configuracion.

## Notas de despliegue

Para montar en un servidor:

```bash
npm run build
```

El resultado queda en `dist/`. Puedes publicarlo en Netlify, Vercel, Cloudflare Pages, Nginx o cualquier hosting estatico. Configura las mismas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el servicio donde publiques.

## Archivo Excel revisado

La hoja `Flujo` contiene bloques mensuales desde marzo a diciembre. Cada mes repite columnas `Glosa`, `Tipo` y `Monto`, con movimientos como `Sueldo`, `CMR`, `Banco de Chile`, `Ahorro`, `Inversion Racional`, `Chat GPT`, `Gastos del Viaje`, y saldos como `Balance del Mes`, `Ahorro Acumulado TENPO` y `Total inversiones`. La app toma esa logica y la normaliza en una tabla de movimientos por usuario, año y mes.
