# Manual funcional para usuarios - FinTrack Pro

Este documento explica las funciones principales del sistema FinTrack Pro desde el inicio del panel hasta la seccion **Mi perfil**. Esta pensado para usuarios finales, por lo que describe que hace cada modulo, cuando usarlo y que informacion registra.

## 1. Objetivo del sistema

FinTrack Pro permite controlar cuentas, clientes, cobros, prestamos, ingresos, egresos, presupuestos, metas y reportes desde una sola aplicacion.

El sistema esta organizado por secciones para separar claramente:

- Dinero disponible.
- Clientes y cuentas por cobrar.
- Prestamos que el usuario debe pagar.
- Movimientos generales de caja.
- Planificacion financiera.
- Analisis y respaldos.
- Informacion personal del usuario.

## 2. Acceso al sistema

Cada usuario ingresa con su correo y contrasena. En dispositivos moviles tambien puede usar la opcion de recordar cuenta y desbloquear con PIN, si previamente creo su PIN desde **Mi perfil**.

Al ingresar, el sistema carga el panel principal y aplica la apariencia visual configurada por el usuario en ese dispositivo.

## 3. Dashboard

El **Dashboard** es la pantalla principal del sistema. Resume la informacion financiera mas importante.

### Informacion que muestra

- Balance total de cuentas.
- Cuentas por cobrar pendientes.
- Cobros del mes.
- Comparacion de ingresos y egresos.
- Cuentas por cobrar por vencer.
- Ultimos cobros recibidos.
- Alertas de presupuesto.
- Metas proximas.

### Configurar dashboard

El boton **Configurar dashboard** permite elegir que tarjetas se muestran. El cambio solo se aplica cuando el usuario guarda la configuracion.

## 4. Clientes

El modulo **Clientes** sirve para registrar a las personas o empresas relacionadas con el administrador.

### Para que se usa

- Registrar clientes.
- Editar datos de clientes.
- Eliminar clientes si el usuario tiene permiso.
- Consultar documento, telefono, correo y direccion.

### Importante

Los clientes no son lo mismo que los usuarios que inician sesion. Un usuario es una cuenta de acceso al sistema. Un cliente es una persona o empresa con la que se registran cobros, cuentas por cobrar o prestamos por cobrar.

## 5. Cuentas y caja

El modulo **Cuentas y caja** administra las cuentas bancarias, billeteras o cajas de efectivo.

### Para que se usa

- Crear cuentas bancarias o billeteras.
- Registrar saldo inicial.
- Editar o eliminar cuentas.
- Ver saldo por cuenta.
- Consultar historial relacionado a cada cuenta.

### Transferencias

Desde este modulo se pueden registrar transferencias:

- Entre cuentas propias.
- Hacia otras cuentas externas.

Las transferencias permiten mover dinero sin confundirlo con ingresos o egresos reales.

## 6. Movimientos de caja

El modulo **Movimientos de caja** registra ingresos y egresos generales.

### Ingresos

Representan dinero que entra a una cuenta y no necesariamente esta relacionado con una cuenta por cobrar.

Ejemplos:

- Pago empresa.
- Pago extra.
- Ingreso adicional.

### Egresos

Representan dinero que sale de una cuenta.

Ejemplos:

- Servicios.
- Plataformas.
- Proveedores.
- Gastos operativos.

### Tipos de movimiento

El sistema permite mantener tipos o categorias para clasificar mejor los ingresos y egresos. Esto ayuda a que los reportes sean mas claros.

## 7. Cuentas por cobrar

El modulo **Cuentas por cobrar** registra dinero que otras personas o empresas deben pagar al usuario.

### Casos de uso

- Venta pendiente de cobro.
- Servicio pendiente de cobro.
- Prestamo otorgado a un cliente.
- Otro importe que debe cobrarse despues.

### Campos principales

- Cliente.
- Concepto.
- Tipo.
- Cuenta origen, si corresponde.
- Importe.
- Cobrado.
- Saldo.
- Fecha de vencimiento.
- Estado.

### Prestamos por cobrar

Si se registra una cuenta por cobrar de tipo prestamo, el sistema puede asociar la cuenta desde donde salio el dinero. Esto permite controlar correctamente el saldo pendiente por cobrar.

## 8. Cobros recibidos

El modulo **Cobros recibidos** registra el dinero que entra cuando un cliente paga una cuenta por cobrar.

### Que hace al registrar un cobro

- Reduce el saldo pendiente de la cuenta por cobrar.
- Aumenta el saldo de la cuenta destino seleccionada.
- Guarda fecha, metodo, referencia y notas.

### Diferencia con movimientos de caja

Un cobro recibido esta relacionado con una cuenta por cobrar. Un ingreso general en movimientos de caja no necesariamente tiene una cuenta por cobrar asociada.

## 9. Prestamos por pagar

El modulo **Prestamos por pagar** registra dinero que le prestaron al usuario y que todavia debe devolver.

### Casos de uso

- Prestamo de banco.
- Prestamo familiar.
- Prestamo de proveedor.
- Deuda antigua que aun falta pagar.

### Prestamo nuevo

Si el dinero aun entra a una cuenta actual, el sistema puede sumar ese importe a la cuenta seleccionada.

### Prestamo antiguo

Si el dinero fue recibido hace meses y ya no esta disponible, se puede marcar como prestamo antiguo. En ese caso se registra solo el saldo por pagar y no se mueve ninguna cuenta actual.

### Campo acreedor

El acreedor es la persona, banco, empresa o proveedor al que se le debe pagar.

## 10. Pagos a acreedores

El modulo **Pagos a acreedores** registra los pagos realizados para reducir prestamos por pagar.

### Que hace al registrar un pago

- Descuenta dinero de la cuenta origen.
- Reduce el saldo pendiente del prestamo por pagar.
- Guarda fecha, metodo y notas.

### Diferencia con egresos

Un pago a acreedor reduce una deuda existente. Un egreso general solo registra una salida de dinero sin relacionarla con un prestamo por pagar.

## 11. Presupuestos

El modulo **Presupuestos** permite definir limites por mes, tipo y categoria.

### Para que sirve

- Controlar gastos o ingresos esperados.
- Detectar cuando una categoria esta cerca del limite.
- Mostrar alertas en el Dashboard.

### Informacion principal

- Mes.
- Tipo.
- Categoria.
- Limite.
- Usado.
- Avance.

## 12. Metas financieras

El modulo **Metas financieras** permite registrar objetivos de ahorro o crecimiento.

### Ejemplos

- Ahorrar para una compra.
- Crear fondo de emergencia.
- Llegar a cierto monto en una cuenta.

### Informacion principal

- Nombre de la meta.
- Monto objetivo.
- Monto actual.
- Avance.
- Fecha.
- Estado.

## 13. Reportes

El modulo **Reportes** resume la informacion registrada.

### Reportes disponibles

- Resumen por cliente.
- Total por cobrar.
- Cobrado.
- Saldo por cobrar.
- Ingresos y egresos por tipo.

### Exportaciones

El sistema permite exportar informacion para analisis externo o respaldo, si el usuario tiene permiso.

## 14. Backup

El modulo **Backup** permite descargar e importar informacion.

### Funciones principales

- Descargar backup completo en JSON.
- Exportar tablas principales a CSV.
- Descargar plantillas.
- Importar clientes desde CSV o Excel.
- Importar movimientos desde CSV o Excel.

### Recomendacion

Usar el backup antes de hacer cambios masivos o importaciones grandes.

## 15. Auditoria

El modulo **Auditoria** muestra acciones importantes realizadas en el sistema.

### Para que sirve

- Revisar cambios relevantes.
- Consultar fecha, tabla y accion.
- Ver datos asociados a una operacion.

Este modulo ayuda a tener trazabilidad de lo que ocurre en el sistema.

## 16. Mi perfil

La seccion **Mi perfil** permite administrar informacion personal, seguridad y apariencia visual.

### Informacion personal

Permite actualizar:

- Nombre.
- Apellido.
- Tipo de documento.
- Documento.
- Email de contacto.
- Telefono.
- Direccion.
- Empresa o negocio.
- Moneda predeterminada.

### Seguridad

La tarjeta **Seguridad** agrupa:

- PIN movil.
- Cambio de contrasena.
- Cierre de sesion en todos los dispositivos.

#### PIN movil

El PIN movil tiene 6 digitos y sirve para desbloquear la app en este celular cuando se usa recordar cuenta.

#### Cambio de contrasena

Permite actualizar la contrasena con la que el usuario inicia sesion por correo. El sistema muestra validaciones de seguridad como longitud, mayusculas, minusculas, numeros y simbolos.

#### Cerrar sesion en todos

Cierra la sesion activa en todos los dispositivos. Despues de usar esta opcion, el usuario debe volver a iniciar sesion.

### Apariencia

La tarjeta **Apariencia** permite personalizar como se ve el sistema para el usuario.

Opciones disponibles:

- Tema claro u oscuro.
- Estilo visual.
- Superficies.
- Densidad.
- Color principal.
- Color secundario.
- Presets visuales.

La apariencia se guarda por usuario en el dispositivo actual. Si el usuario entra desde otro navegador o celular, puede configurar su apariencia nuevamente.

## 17. Permisos

Algunas opciones pueden no aparecer o no permitir crear, editar, eliminar o exportar datos. Esto depende de los permisos asignados por el administrador.

Si un usuario no ve una opcion esperada, debe solicitar al administrador que revise sus permisos.

## 18. Flujo recomendado de uso

1. Registrar clientes.
2. Crear cuentas y caja.
3. Registrar cuentas por cobrar si alguien debe pagar.
4. Registrar cobros recibidos cuando el cliente paga.
5. Registrar movimientos de caja para ingresos o egresos generales.
6. Registrar prestamos por pagar si el usuario debe dinero.
7. Registrar pagos a acreedores cuando se pague una deuda.
8. Crear presupuestos y metas.
9. Revisar Dashboard y Reportes.
10. Usar Backup periodicamente.
11. Mantener actualizado Mi perfil.

