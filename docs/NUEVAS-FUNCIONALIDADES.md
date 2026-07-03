# Nuevas funcionalidades implementadas

## SQL requerido

Ejecuta este archivo completo en Supabase SQL Editor:

```txt
../supabase/sql/FINTRACK-FEATURES-SCHEMA.sql
../supabase/sql/DEUDAS-PRESTAMOS-SCHEMA.sql
../supabase/sql/PRESTAMOS-RECIBIDOS-SCHEMA.sql
```

Sin ese SQL, las pantallas nuevas pueden abrir, pero Supabase devolvera errores porque aun no existen las tablas `presupuestos`, `metas` y `auditoria`.

## Funcionalidades agregadas

- Presupuestos mensuales por tipo de ingreso/egreso.
- Metas financieras con avance porcentual.
- Alertas internas en Dashboard:
  - presupuestos al 80% o mas;
  - metas al 80% o mas.
- Reportes ampliados:
  - ingresos acumulados;
  - egresos acumulados;
  - resumen por cliente;
  - movimientos por tipo;
  - exportacion JSON.
- Backup:
  - descarga JSON completo;
  - descarga CSV por tabla principal.
- Auditoria:
  - registra acciones importantes de presupuestos y metas.
- Historial por cuenta bancaria:
  - movimientos;
  - pagos;
  - transferencias enviadas y recibidas.
- Separacion contable:
  - `Deudas`: ventas, servicios u otros pendientes por cobrar. No mueven saldo al crearse.
  - `Prestamos`: dinero que sale desde una cuenta hacia un cliente. Cuentan como egreso.
  - `Cobros de prestamos`: pagos que devuelve el cliente. Cuentan como ingreso.
- Prestamos con desembolso:
  - se registran en la vista `Prestamos`;
  - crean una deuda por cobrar;
  - descuentan el saldo de la cuenta origen;
  - registran un egreso automatico en movimientos.
  - se pueden editar y eliminar con reversion contable del saldo.
- Cobros de prestamos:
  - se pueden editar y eliminar;
  - al editar/eliminar se revierte el saldo de cuenta y el monto cobrado.
- Prestamos recibidos:
  - registra dinero que terceros te prestaron;
  - permite modo antiguo sin mover saldo actual;
  - permite modo nuevo con ingreso a cuenta.
- Pagos de prestamos recibidos:
  - descuenta dinero de tu cuenta;
  - reduce el saldo pendiente que debes;
  - permite editar y eliminar con reversion contable.
- Todas las tablas usan paginacion.
- Preparacion para adjuntos:
  - columnas `comprobante_url` en `movimientos` y `pagos`.

## Pendiente para adjuntos reales

Para subir imagenes/PDF directamente desde la app falta configurar Supabase Storage:

- crear bucket;
- definir politicas RLS del bucket;
- agregar subida de archivo en los modales.

Por ahora se dejo preparada la base de datos con `comprobante_url`.

