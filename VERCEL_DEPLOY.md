# Despliegue en Vercel

## Configuracion del proyecto

Vercel debe usar:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

El archivo `vercel.json` ya deja configurado `buildCommand`, `outputDirectory` y la redireccion a `index.html`.

## Variables de entorno

En Vercel, agrega estas variables en **Project Settings > Environment Variables**:

```text
VITE_SUPABASE_URL=https://whidcnwqmdwggxpxyktl.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY
```

Importante: no subas ni configures la `secret key` de Supabase en Vercel para esta app frontend.

## Pasos desde la web

1. Sube el proyecto a GitHub.
2. Entra a Vercel.
3. Click en **Add New > Project**.
4. Importa el repositorio.
5. Si el repo contiene la carpeta `app-financiera`, pon **Root Directory** en `app-financiera`.
6. Agrega las variables de entorno.
7. Deploy.

## Ajuste obligatorio en Supabase

Cuando Vercel entregue la URL final, por ejemplo:

```text
https://app-financiera.vercel.app
```

Ve a Supabase:

```text
Authentication > URL Configuration
```

Configura:

```text
Site URL: https://app-financiera.vercel.app
Redirect URLs:
https://app-financiera.vercel.app
https://app-financiera.vercel.app/*
```

Esto es necesario para recuperacion de contraseña y redirecciones de Auth.

## Probar antes de subir

```bash
npm install
npm run build
```

Si el build pasa, Vercel deberia desplegar sin cambios extra.
