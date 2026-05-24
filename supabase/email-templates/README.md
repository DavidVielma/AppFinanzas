# Correos transaccionales de Fluxa

Estos archivos son plantillas HTML para pegar en Supabase:

- `confirm-signup.html`: Authentication > Emails > Confirm signup.
- `reset-password.html`: Authentication > Emails > Reset password.
- `invite-user.html`: Authentication > Emails > Invite user.

## Configurar proveedor SMTP

1. Crea y verifica un dominio o remitente en tu proveedor de correos transaccionales.
2. En Supabase abre `Authentication > SMTP Settings`.
3. Activa `Enable Custom SMTP`.
4. Completa el servidor, puerto, usuario y contrasena SMTP del proveedor.
5. Usa un remitente formal, por ejemplo `Fluxa <no-reply@tudominio.cl>`.
6. Guarda y prueba un registro o una recuperacion de contrasena.

Para Brevo, el servidor SMTP suele ser `smtp-relay.brevo.com`. El usuario y la contrasena se obtienen desde la seccion SMTP/API del panel de Brevo. Si usas Resend, SendGrid, Mailgun u otro proveedor, usa los datos SMTP equivalentes.

## URLs importantes

En Supabase revisa `Authentication > URL Configuration`:

- `Site URL`: debe ser la URL publica de la app, por ejemplo `https://tu-app.vercel.app`.
- `Redirect URLs`: agrega la URL publica y las URLs locales que uses para pruebas.

En la app define `VITE_SITE_URL` con la misma URL publica para que los enlaces de registro y recuperacion no apunten a `localhost` en produccion.
