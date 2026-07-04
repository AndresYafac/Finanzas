# FinTrack Pro - Resumen de trabajo y pendientes

Fecha: 04/07/2026

## 1. Objetivo del proyecto

FinTrack Pro pasó de ser una vista HTML local a una aplicación React con Supabase, pensada para usarse en web y móvil como sistema de gestión financiera personal/administrativa.

El sistema ahora permite trabajar con usuarios, clientes, cuentas bancarias, deudas por cobrar, préstamos otorgados, préstamos recibidos, pagos, ingresos, egresos, presupuestos, metas, reportes, backup, auditoría, permisos y configuración.

## 2. Estructura actual del proyecto

- `src/main.jsx`: contiene la mayor parte de las vistas y lógica principal de la app.
- `src/components/ui.jsx`: componentes reutilizables como modales, tablas, acciones, formularios y diálogos.
- `src/styles.css`: estilos globales, diseño web, diseño móvil, modales, cards, menú, dashboard y formularios.
- `src/config/supabase.js`: creación del cliente Supabase.
- `src/controllers`: lógica separada para autenticación y perfil.
- `src/services/feedback.js`: alertas personalizadas, confirmaciones y estados de carga.
- `src/utils`: utilidades de formato, seguridad y helpers.
- `public/sw.js`: service worker para PWA/offline.
- `public/offline.html`: pantalla básica offline.
- `public/icons`: iconos de la aplicación.
- `docs`: documentación del proyecto.
- `supabase/sql`: scripts SQL organizados para crear o reparar tablas, funciones, RLS y permisos.

## 3. Migración a React y MVC inicial

Se migró el sistema a React con Vite.

Se organizó parcialmente con enfoque MVC:

- Modelo/base de datos: scripts SQL en `supabase/sql`.
- Controladores: `src/controllers`.
- Servicios: `src/services`.
- Vistas/componentes: `src/main.jsx` y `src/components`.
- Configuración: `src/config`.

Pendiente importante: `src/main.jsx` todavía está demasiado grande. Para un MVC más limpio se debe separar cada vista en archivos independientes.

## 4. Supabase y autenticación

Se integró Supabase con:

- URL y anon key por variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Login con correo y contraseña.
- Registro de usuarios.
- Confirmación por correo.
- Perfil del usuario.
- Rol `admin` y rol `user`.
- Primer administrador.
- Recordar cuenta.
- PIN móvil de 6 dígitos.
- Cambio de contraseña desde Mi perfil.
- Cerrar sesión normal y cierre global de sesiones.

También se corrigieron problemas relacionados con:

- URL de Supabase mal ingresada.
- Uso de anon key en vez de service role.
- RLS en tablas.
- Usuario admin tomado como user.
- Falta de columnas en `profiles`.
- Permisos sobre `profiles`.

## 5. Usuarios, clientes y permisos

Se aclaró y corrigió la lógica:

- `profiles` representa usuarios del sistema.
- `clientes` representa clientes registrados por el administrador.
- Un usuario registrado no debe aparecer automáticamente como cliente.
- El administrador puede registrar clientes desde la vista Clientes.
- Los clientes se usan en deudas, pagos, préstamos y cobros.

Se agregó vista de administración de usuarios solo para administradores:

- Listar usuarios.
- Activar/desactivar usuarios.
- Editar usuarios.
- Eliminación lógica.
- Evitar operar sobre el propio usuario.
- Configurar permisos por usuario.

Se agregó sistema de permisos por módulo:

- Ver.
- Crear.
- Editar.
- Eliminar.
- Exportar.

El modal de permisos fue rediseñado con cards por módulo y checkboxes visuales para que vaya acorde al diseño del sistema.

Script relacionado:

- `supabase/sql/PERMISOS-AUDITORIA-AVANZADA.sql`

## 6. Módulos financieros implementados o corregidos

### Dashboard

Se mejoró con:

- Cards principales.
- Balance de cuentas.
- Pendiente por cobrar.
- Pagos del mes.
- Ingresos / egresos.
- Gráficos simples dentro de las cards.
- Deudas por vencer.
- Últimos pagos.
- Alertas de presupuesto.
- Metas próximas.
- Configuración de cards visibles.

### Clientes

Se agregó o corrigió:

- Registro de clientes.
- Edición y eliminación.
- Separación correcta entre clientes y usuarios.
- Paginación.
- Uso en combos financieros.

### Cuentas bancarias

Se ajustó para:

- Mostrar cuentas como cards.
- Editar/eliminar desde la card.
- Quitar tabla innecesaria.
- Registrar transferencias entre cuentas propias.
- Registrar transferencias hacia otras cuentas.
- Actualizar saldos según movimientos.

### Deudas por cobrar

Se redefinió la lógica:

- Son deudas que un cliente tiene conmigo.
- No descuentan una cuenta al crearse.
- Se consideran pendientes por cobrar.
- Cuando el cliente paga, se registra un pago/cobro y eso aumenta la cuenta bancaria.

### Pagos / cobros generales

Se corrigió la lógica:

- Un pago recibido de cliente es ingreso.
- Debe aumentar la cuenta bancaria.
- Se agregó relación con cuenta bancaria.
- Se agregó edición y eliminación para corregir operaciones.

### Préstamos otorgados

Se separó de deudas:

- Representa dinero que yo presto a un cliente.
- Al registrar un préstamo otorgado, debe contar como egreso si sale de una cuenta.
- El cobro de ese préstamo cuenta como ingreso.

### Cobros de préstamos

Se agregó vista para registrar pagos recibidos por préstamos otorgados.

### Préstamos recibidos

Se agregó lógica para dinero que me prestaron a mí:

- Acreedor: persona, entidad o empresa que me prestó dinero.
- Si el dinero ya no está en cuenta porque fue hace meses, se puede registrar como deuda histórica sin afectar saldo actual.
- Si el dinero entra a una cuenta, puede registrarse afectando saldo.

### Pagos de préstamos recibidos

Se agregó vista para registrar pagos que hago a mis acreedores.

### Ingresos / egresos

Se agregó:

- Movimiento tipo ingreso o egreso.
- Selección de cuenta bancaria afectada.
- Categorías/tipos de movimiento.
- Mantenimiento de tipos de ingreso/egreso.
- Egresos como servicios, plataformas, proveedores.
- Ingresos como pago empresa, pago extra, etc.

### Presupuestos

Se agregó control mensual de presupuestos por categoría/tipo.

### Metas

Se agregó control de metas financieras.

## 7. Reportes, backup y auditoría

### Reportes

Se corrigió exportación:

- CSV.
- JSON.
- PDF imprimible desde navegador.
- Filtros por fecha.
- Resumen por cliente.
- Resumen por ingresos/egresos.

### Backup

Se agregó:

- Exportación de información.
- Importación CSV/XLSX.
- Dependencia `xlsx`.

### Auditoría

Se agregó:

- Registro de acciones importantes.
- Función avanzada `registrar_auditoria_avanzada`.
- Consulta de auditoría.
- Filtros.

## 8. PWA y publicación

Se agregó soporte para app instalable:

- Manifest.
- Service worker.
- Página offline.
- Botón "Instalar app".
- Detección de actualización disponible.
- Compatibilidad básica para Vercel.

También se corrigió el problema de que en Vercel volvía a pedir Supabase, indicando que las variables deben configurarse en Production, no solo Development.

Variables esperadas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 9. Diseño web y móvil

Se trabajó en:

- Menú lateral web.
- Opción para ocultar/mostrar menú en web.
- Menú inferior móvil.
- Corrección de scroll lateral.
- Uso de pantalla completa en vistas generales.
- Perfil y configuración centrados.
- Cards más limpias.
- Modales para guardar/editar.
- Alertas personalizadas en lugar de alerts del navegador.
- Estados visuales de carga al ingresar, guardar, borrar, eliminar y descargar.
- Botón de cerrar sesión visible en móvil.
- Rediseño de Mi perfil para web y móvil.
- Corrección de botones tapados por menú inferior móvil.
- Rediseño de iconos de notificaciones y ocultar menú.

## 10. Scripts SQL importantes

Scripts principales en `supabase/sql`:

- `supabase-schema.sql`: esquema base.
- `PERFIL-SCHEMA.sql`: columnas de perfil.
- `PIN-MOVIL-SCHEMA.sql`: PIN móvil.
- `MOVIMIENTOS-SCHEMA.sql`: movimientos.
- `TIPOS-MOVIMIENTO-SCHEMA.sql`: tipos de ingreso/egreso.
- `MOVIMIENTOS-CUENTAS-SCHEMA.sql`: movimientos asociados a cuentas.
- `TRANSFERENCIAS-SCHEMA.sql`: transferencias.
- `DEUDAS-PRESTAMOS-SCHEMA.sql`: deudas y préstamos.
- `PRESTAMOS-RECIBIDOS-SCHEMA.sql`: préstamos recibidos.
- `REPARAR-RPC-PAGOS.sql`: función de pagos.
- `ADMIN-USUARIOS-SCHEMA.sql`: administración de usuarios.
- `PERMISOS-AUDITORIA-AVANZADA.sql`: permisos, auditoría avanzada y storage.

## 11. Validaciones realizadas

Se ejecutó build varias veces:

```bash
npm run build
```

El build terminó correctamente después de los cambios recientes.

## 12. Pendientes técnicos importantes

### Alta prioridad

1. Separar `src/main.jsx` en vistas independientes.

   Ahora el archivo concentra demasiadas responsabilidades. Recomendación:

   - `src/views/Dashboard.jsx`
   - `src/views/Clientes.jsx`
   - `src/views/Cuentas.jsx`
   - `src/views/Deudas.jsx`
   - `src/views/PrestamosOtorgados.jsx`
   - `src/views/PrestamosRecibidos.jsx`
   - `src/views/Pagos.jsx`
   - `src/views/Movimientos.jsx`
   - `src/views/Reportes.jsx`
   - `src/views/Perfil.jsx`
   - `src/views/UsuariosAdmin.jsx`

2. Crear una capa real de servicios por entidad.

   Ejemplo:

   - `src/services/clientes.service.js`
   - `src/services/cuentas.service.js`
   - `src/services/deudas.service.js`
   - `src/services/prestamos.service.js`
   - `src/services/reportes.service.js`

3. Revisar todas las políticas RLS en Supabase.

   El sistema depende de RLS para seguridad. Hay que validar tabla por tabla:

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

4. Validar saldos con funciones SQL transaccionales.

   Las operaciones que cambian dinero deberían ejecutarse con RPCs atómicas para evitar inconsistencias:

   - registrar pago.
   - editar pago.
   - eliminar pago.
   - registrar egreso.
   - editar egreso.
   - eliminar egreso.
   - transferencias.
   - préstamo otorgado.
   - cobro de préstamo.
   - préstamo recibido.
   - pago de préstamo recibido.

5. Crear pruebas manuales o automatizadas por flujo financiero.

   Flujos mínimos:

   - crear cuenta.
   - crear cliente.
   - crear deuda.
   - registrar pago de deuda.
   - editar pago.
   - eliminar pago.
   - registrar préstamo otorgado.
   - cobrar préstamo.
   - registrar préstamo recibido histórico.
   - pagar préstamo recibido.
   - registrar ingreso.
   - registrar egreso.
   - transferir entre cuentas.

### Prioridad media

6. Mejorar dashboard con gráficos más completos.

   Posibles gráficos:

   - Ingresos vs egresos por mes.
   - Saldos por cuenta.
   - Top clientes con deuda.
   - Categorías con mayor gasto.
   - Evolución de patrimonio.

7. Agregar filtros avanzados en todas las tablas.

   Ejemplo:

   - fecha desde/hasta.
   - cliente.
   - cuenta.
   - estado.
   - tipo.
   - monto mínimo/máximo.

8. Agregar exportación PDF por módulo.

   Ya existe exportación en reportes, pero faltaría por módulo:

   - clientes.
   - cuentas.
   - deudas.
   - pagos.
   - préstamos.
   - movimientos.

9. Mejorar importaciones.

   Pendiente:

   - Validación previa antes de importar.
   - Vista de errores por fila.
   - Plantillas descargables CSV/XLSX.

10. Mejorar auditoría.

   Pendiente:

   - Mostrar antes/después de cambios.
   - Filtros por usuario.
   - Exportar auditoría.
   - Registrar IP/user agent si es necesario.

### Prioridad baja

11. Notificaciones internas más completas.

   Posibles alertas:

   - Deudas vencidas.
   - Presupuestos superados.
   - Metas vencidas.
   - Saldos bajos.
   - Préstamos por cobrar.
   - Pagos próximos.

12. Modo oscuro.

13. Personalización visual.

   - Logo desde configuración.
   - Colores de marca.
   - Nombre de empresa.
   - Datos para reportes.

14. Multi-moneda real.

   Actualmente hay campo moneda, pero falta:

   - Tipo de cambio.
   - Conversión.
   - Reportes consolidados.

15. Adjuntos y comprobantes.

   Usar Supabase Storage para:

   - vouchers.
   - recibos.
   - contratos.
   - comprobantes de pago.

16. Recordatorios reales.

   Para recordatorios por correo o push se necesita backend adicional:

   - Supabase Edge Functions.
   - Cron jobs.
   - Servicio externo de email/push.

## 13. Recomendación de siguiente paso

Antes de agregar más funciones nuevas, conviene hacer una limpieza técnica:

1. Separar `src/main.jsx` por vistas.
2. Crear servicios por entidad.
3. Revisar RLS y RPCs financieras.
4. Hacer pruebas flujo por flujo.

Eso va a dejar el proyecto más estable para seguir creciendo sin romper funcionalidades ya terminadas.
