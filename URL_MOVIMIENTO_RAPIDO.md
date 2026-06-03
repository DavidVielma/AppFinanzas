# URL de movimiento rapido

La app puede abrir el modal de registro de movimiento usando parametros explicitos en la URL.

URL base de produccion:

```text
https://app-financiera-lovat.vercel.app/
```

## Parametros aceptados

| Parametro | Alias | Obligatorio | Ejemplo | Uso |
| --- | --- | --- | --- | --- |
| `monto` | `amount` | Si | `monto=-20000` | Monto inicial del movimiento. Positivo crea ingreso, negativo crea egreso. |
| `descripcion` | `description` | No | `descripcion=farmacia` | Texto inicial de la descripcion. |
| `categoria` | `category` | No | `categoria=Salud` | Categoria inicial del movimiento. |
| `year` | - | No | `year=2026` | Anio donde se abrira el movimiento. |
| `month` | - | No | `month=6` | Mes donde se abrira el movimiento, de `1` a `12`. |
| `status` | `estado` | No | `status=Confirmado` | Estado del movimiento: `Proyectado`, `Confirmado` o `Pendiente`. |

## Ejemplos

```text
https://app-financiera-lovat.vercel.app/?monto=-20000&descripcion=farmacia&categoria=Salud&status=Confirmado
https://app-financiera-lovat.vercel.app/?monto=-12000&descripcion=Uber&categoria=Transporte&year=2026&month=6
https://app-financiera-lovat.vercel.app/?amount=145000&description=Pago%20cliente&categoria=Honorarios&status=Confirmado
https://app-financiera-lovat.vercel.app/?monto=50000&descripcion=Reembolso&categoria=Reembolso&estado=Pendiente
```

## Opciones

### Gasto

Usa `monto` negativo:

```text
https://app-financiera-lovat.vercel.app/?monto=-20000&descripcion=farmacia&categoria=Salud
```

### Ingreso

Usa `monto` positivo:

```text
https://app-financiera-lovat.vercel.app/?monto=50000&descripcion=Pago%20cliente&categoria=Honorarios
```

### Estado inicial

Puedes abrir el modal con estado preseleccionado:

```text
https://app-financiera-lovat.vercel.app/?monto=-12000&descripcion=Uber&status=Confirmado
https://app-financiera-lovat.vercel.app/?monto=-12000&descripcion=Uber&estado=Pendiente
```

### Periodo

Puedes forzar anio y mes:

```text
https://app-financiera-lovat.vercel.app/?monto=-12000&descripcion=Uber&year=2026&month=6
```

## Automatizaciones y PWA

La app esta configurada como PWA con `scope: "/"`, `start_url: "/"` y service worker. Para que una automatizacion abra Fluxa como app instalada:

1. Abre `https://app-financiera-lovat.vercel.app/` en Chrome/Android.
2. Instala Fluxa con **Agregar a pantalla de inicio** o **Instalar app**.
3. En tu automatizacion usa una URL dentro del mismo dominio.

## Notas

- `monto` acepta numeros con punto o coma, por ejemplo `2300`, `2.300` o `2300,50`.
- Si no se envia `year` o `month`, se usa el anio y mes actual seleccionado por la app.
- La URL solo precarga el modal; el movimiento se guarda cuando presionas **Agregar**.
