# QA - Flujos financieros FinTrack Pro

Fecha: 04/07/2026

Usar esta lista antes de publicar cambios a producción.

## Preparación

- Crear un usuario administrador.
- Crear al menos un usuario normal.
- Crear dos cuentas bancarias.
- Crear dos clientes.
- Confirmar que Supabase tiene RLS activo.
- Confirmar que las variables de Vercel están en Production.

## Cuentas

- Crear cuenta bancaria.
- Editar cuenta bancaria.
- Eliminar cuenta bancaria sin movimientos.
- Intentar eliminar cuenta con movimientos y verificar comportamiento esperado.
- Transferir entre dos cuentas propias.
- Verificar que una cuenta disminuye y la otra aumenta.
- Registrar transferencia a cuenta externa.
- Verificar que la cuenta origen disminuye.

## Clientes

- Crear cliente.
- Editar cliente.
- Eliminar cliente sin operaciones.
- Validar que usuarios de `profiles` no aparecen como clientes.
- Validar que el cliente aparece en combos financieros.

## Deudas por cobrar

- Crear deuda de cliente.
- Verificar que no descuenta ninguna cuenta al crearla.
- Editar deuda.
- Registrar pago parcial.
- Verificar que el pago aumenta la cuenta seleccionada.
- Registrar pago total.
- Verificar estado pagado.
- Eliminar pago y confirmar reversa de saldo.

## Préstamos otorgados

- Crear préstamo otorgado afectando cuenta.
- Verificar que la cuenta disminuye.
- Registrar cobro parcial.
- Verificar que la cuenta aumenta.
- Editar préstamo.
- Editar cobro.
- Eliminar cobro y validar reversa.
- Eliminar préstamo y validar reglas.

## Préstamos recibidos

- Crear préstamo recibido histórico sin afectar cuenta.
- Confirmar que no cambia saldo.
- Crear préstamo recibido con ingreso a cuenta.
- Confirmar que la cuenta aumenta.
- Registrar pago de préstamo recibido.
- Confirmar que la cuenta disminuye.
- Editar pago.
- Eliminar pago y validar reversa.

## Ingresos / egresos

- Registrar ingreso con cuenta.
- Confirmar aumento de saldo.
- Registrar egreso con cuenta.
- Confirmar disminución de saldo.
- Editar ingreso.
- Editar egreso.
- Eliminar ingreso y validar reversa.
- Eliminar egreso y validar reversa.
- Probar tipos de movimiento.
- Probar filtros por fecha, tipo, cuenta y categoría.

## Presupuestos

- Crear presupuesto mensual.
- Registrar egresos relacionados.
- Validar porcentaje usado.
- Validar alerta al superar 80%.
- Validar alerta al superar 100%.

## Metas

- Crear meta.
- Editar meta.
- Actualizar avance.
- Marcar como completada.
- Validar alerta de fecha vencida.

## Reportes

- Filtrar por fecha.
- Exportar CSV.
- Exportar JSON.
- Exportar PDF.
- Verificar montos contra cuentas y movimientos.

## Backup e importación

- Exportar datos.
- Importar CSV válido.
- Importar XLSX válido.
- Probar archivo con columnas faltantes.
- Probar archivo con montos inválidos.
- Confirmar que se muestran errores por fila.

## Auditoría

- Crear, editar y eliminar registros principales.
- Confirmar registro en auditoría.
- Filtrar por tabla.
- Filtrar por acción.
- Exportar auditoría.

## Permisos

- Crear usuario normal.
- Quitar permiso de ver a un módulo.
- Confirmar que el módulo no aparece.
- Quitar permiso de crear.
- Confirmar que el botón nuevo no aparece o bloquea.
- Quitar permiso de editar/eliminar/exportar.
- Confirmar bloqueo por acción.

## Móvil

- Login en móvil.
- Ver selector de módulos.
- Entrar a módulo.
- Volver a módulos.
- Confirmar que no aparece menú inferior fijo.
- Probar modales sin que botones queden tapados.

## Resultado

Registrar aquí fecha, usuario de prueba y observaciones antes de cada publicación.
