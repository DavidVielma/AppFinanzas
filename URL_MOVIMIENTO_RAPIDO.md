# URL de movimiento rapido

La app puede abrir el modal de registro de movimiento usando parametros en la URL.

## Parametros aceptados

| Parametro | Alias | Obligatorio | Ejemplo | Uso |
| --- | --- | --- | --- | --- |
| `monto` | `amount` | Si | `monto=2300` | Monto inicial del movimiento. Positivo crea ingreso, negativo crea egreso. |
| `descripcion` | `description` | No | `descripcion=Bebida` | Texto inicial de la descripcion. |
| `year` | - | No | `year=2026` | Año donde se abrira el movimiento. |
| `month` | - | No | `month=6` | Mes donde se abrira el movimiento, de `1` a `12`. |
| `status` | `estado` | No | `status=Confirmado` | Estado del movimiento: `Proyectado`, `Confirmado` o `Pendiente`. |

## Ejemplos

```text
https://tu-app/?monto=2300
https://tu-app/?monto=-5000&descripcion=Bebida
https://tu-app/?amount=145000&description=Pago%20cliente
https://tu-app/?monto=-12000&descripcion=Uber&year=2026&month=6
https://tu-app/?monto=50000&status=Confirmado
https://tu-app/?amount=-10000&description=Gasto&status=Pendiente
```

URL real de produccion:

```text
https://app-financiera-lovat.vercel.app/?monto=-5000&descripcion=Bebida&status=Confirmado
```

## Automatizaciones y PWA

La app esta configurada como PWA con `scope: "/"`, `start_url: "/"` y service worker. Para que una automatizacion abra Fluxa como app instalada:

1. Abre `https://app-financiera-lovat.vercel.app/` en Chrome/Android.
2. Instala Fluxa con **Agregar a pantalla de inicio** o **Instalar app**.
3. En tu automatizacion usa una URL dentro del mismo dominio, por ejemplo:

```text
https://app-financiera-lovat.vercel.app/?monto=-12000&descripcion=Uber&status=Confirmado
```

En Android/Chrome, al estar instalada, las URLs dentro del alcance de la PWA pueden abrirse en la app instalada. En iOS, Safari normalmente abre URLs desde automatizaciones en Safari; la PWA se abre de forma confiable desde el icono de inicio.

## Notas

- `monto` acepta numeros con punto o coma, por ejemplo `2300`, `2.300` o `2300,50`.
- Si no se envia `year` o `month`, se usa el año y mes actual seleccionado por la app.
- La URL solo precarga el modal; el movimiento se guarda cuando presionas **Agregar**.
