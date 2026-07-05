# Pendientes faltantes no incluidos en esta etapa

Fecha: 04/07/2026

Este archivo separa los pendientes que no se trabajaron en esta etapa por decisión funcional.

## 1. Multi-moneda real

Queda pendiente implementar:

- Tabla de tipos de cambio.
- Conversión entre monedas.
- Reportes consolidados por moneda base.
- Reglas para cuentas en distintas monedas.
- Histórico de tipo de cambio por fecha.

Motivo para dejarlo pendiente: requiere definir reglas contables y fuente de tipo de cambio antes de tocar saldos reales.

## 2. Adjuntos y comprobantes

Queda pendiente implementar:

- Carga de vouchers.
- Recibos.
- Contratos.
- Comprobantes de pago.
- Asociación de archivos a pagos, egresos, préstamos y movimientos.
- Políticas de Supabase Storage por usuario/admin.

Motivo para dejarlo pendiente: requiere diseño de storage, límites de archivo, permisos y limpieza de archivos eliminados.

## 3. Recordatorios reales

Queda pendiente implementar:

- Recordatorios por correo.
- Push notifications.
- Jobs programados.
- Supabase Edge Functions.
- Cron jobs.
- Configuración de horarios y frecuencia.

Motivo para dejarlo pendiente: requiere backend programado. No debe hacerse solo con React porque el navegador no garantiza ejecución en segundo plano.

## Recomendación

Estos tres puntos deben trabajarse en una fase posterior, cuando los flujos financieros principales y las políticas RLS estén cerrados y probados.
