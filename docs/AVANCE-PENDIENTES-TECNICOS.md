# Avance aplicado sobre pendientes técnicos

Fecha: 04/07/2026

Este archivo complementa `docs/RESUMEN-TRABAJO-Y-PENDIENTES.md`, sección 12.

Se trabajaron los pendientes técnicos indicados, excepto:

- Multi-moneda real.
- Adjuntos y comprobantes.
- Recordatorios reales.

Esos puntos quedaron separados en `docs/PENDIENTES-FALTANTES.md`.

## Trabajo realizado

### 1. Separación MVC inicial

Se agregó una base de servicios por entidad en `src/services`:

- `entity.service.js`
- `clientes.service.js`
- `cuentas.service.js`
- `deudas.service.js`
- `prestamos.service.js`
- `reportes.service.js`

Esto deja preparada la extracción progresiva de lógica fuera de `src/main.jsx`.

### 2. Capa de servicios por entidad

Se agregó una capa base para operaciones comunes:

- listar.
- obtener por id.
- crear.
- editar.
- eliminar.
- aplicar filtros reutilizables.

### 3. Revisión RLS

Se creó:

- `supabase/sql/RLS-AUDITORIA-REVISION.sql`

Incluye habilitación de RLS y políticas base para:

- `profiles`
- `clientes`
- `cuentas`
- `deudas`
- `pagos`
- `movimientos`
- `prestamos_recibidos`
- `pagos_prestamos_recibidos`
- `user_permissions`
- `auditoria`

### 4. RPCs transaccionales de saldos

Se creó:

- `supabase/sql/RPC-SALDOS-TRANSACCIONALES.sql`

Incluye funciones base para:

- ajustar saldo de cuenta.
- registrar movimiento con saldo.
- eliminar movimiento con reversa de saldo.

### 5. Pruebas financieras

Se creó:

- `docs/QA-FLUJOS-FINANCIEROS.md`

Incluye checklist para:

- cuentas.
- clientes.
- deudas.
- pagos.
- préstamos otorgados.
- préstamos recibidos.
- ingresos/egresos.
- presupuestos.
- metas.
- reportes.
- backup.
- auditoría.
- permisos.
- móvil.

### 6. Dashboard y notificaciones

Se ampliaron las alertas internas para incluir:

- saldos bajos.
- préstamos recibidos por pagar.
- deudas vencidas o por vencer.
- presupuestos en alerta.
- metas por revisar.

### 7. Importaciones

Se mejoró la importación CSV/XLSX:

- ya no descarta filas inválidas en silencio.
- muestra cantidad de filas omitidas.
- muestra ejemplos de errores por fila.
- valida nombre obligatorio en clientes.
- valida fecha y monto en movimientos.

### 8. Auditoría

Se mejoró auditoría:

- exportación CSV incluye datos antes/después cuando existan.
- tabla muestra resumen técnico del dato auditado.

### 9. Modo oscuro y personalización visual

Se agregó:

- tema claro/oscuro.
- color principal configurable.
- persistencia en `empresa_config`.
- script `supabase/sql/EMPRESA-CONFIG-VISUAL.sql`.

## Validación

Se ejecutó:

```bash
npm run build
```

Resultado: build correcto.

Observación: Vite muestra advertencia de chunk cercano a 500 KB. No rompe la app, pero confirma que el siguiente paso técnico debe ser separar `src/main.jsx` por vistas y aplicar code splitting.
