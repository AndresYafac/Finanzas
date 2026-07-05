# FinTrack Pro - Resumen de trabajo y pendientes

> Nota 2026-07-05: este documento conserva historial del proyecto. El resumen tecnico limpio y actualizado esta en `docs/RESUMEN-TECNICO-ACTUALIZADO.md`.

Fecha: 04/07/2026

## 1. Objetivo del proyecto

FinTrack Pro pasÃ³ de ser una vista HTML local a una aplicaciÃ³n React con Supabase, pensada para usarse en web y mÃ³vil como sistema de gestiÃ³n financiera personal/administrativa.

El sistema ahora permite trabajar con usuarios, clientes, cuentas bancarias, deudas por cobrar, prÃ©stamos otorgados, prÃ©stamos recibidos, pagos, ingresos, egresos, presupuestos, metas, reportes, backup, auditorÃ­a, permisos y configuraciÃ³n.

## 2. Estructura actual del proyecto

- `src/main.jsx`: orquesta sesion, navegacion interna, layout, busqueda global y alertas.
- `src/pages`: vistas principales separadas por modulo.
- `src/pages/finance`: vistas financieras y administrativas separadas por archivo.
- `src/pages/finance/financePageShared.jsx`: helpers compartidos de vistas financieras.
- `src/components/ui.jsx`: componentes reutilizables como modales, tablas, acciones, formularios y dialogos.
- `src/styles.css`: entrada de estilos globales modularizados.
- `src/styles`: estilos separados por base, responsive, modo oscuro y refresco visual.
- `src/config/supabase.js`: creaciÃ³n del cliente Supabase.
- `src/controllers`: lÃ³gica separada para autenticaciÃ³n y perfil.
- `src/services/feedback.js`: alertas personalizadas, confirmaciones y estados de carga.
- `src/utils`: utilidades de formato, seguridad y helpers.
- `public/sw.js`: service worker para PWA/offline.
- `public/offline.html`: pantalla bÃ¡sica offline.
- `public/icons`: iconos de la aplicaciÃ³n.
- `docs`: documentaciÃ³n del proyecto.
- `supabase/sql`: scripts SQL organizados para crear o reparar tablas, funciones, RLS y permisos.

## 3. MigraciÃ³n a React y MVC inicial

Se migrÃ³ el sistema a React con Vite.

Se organizo con enfoque MVC inicial:

- Modelo/base de datos: scripts SQL en `supabase/sql`.
- Controladores: `src/controllers`.
- Servicios: `src/services`.
- Vistas/componentes: `src/pages`, `src/pages/finance`, `src/components` y `src/components/layout`.
- ConfiguraciÃ³n: `src/config`.

Estado actual: `src/main.jsx` ya no concentra las vistas principales; quedo como orquestador de la aplicacion.

## 4. Supabase y autenticaciÃ³n

Se integrÃ³ Supabase con:

- URL y anon key por variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Login con correo y contraseÃ±a.
- Registro de usuarios.
- ConfirmaciÃ³n por correo.
- Perfil del usuario.
- Rol `admin` y rol `user`.
- Primer administrador.
- Recordar cuenta.
- PIN mÃ³vil de 6 dÃ­gitos.
- Cambio de contraseÃ±a desde Mi perfil.
- Cerrar sesiÃ³n normal y cierre global de sesiones.

TambiÃ©n se corrigieron problemas relacionados con:

- URL de Supabase mal ingresada.
- Uso de anon key en vez de service role.
- RLS en tablas.
- Usuario admin tomado como user.
- Falta de columnas en `profiles`.
- Permisos sobre `profiles`.

## 5. Usuarios, clientes y permisos

Se aclarÃ³ y corrigiÃ³ la lÃ³gica:

- `profiles` representa usuarios del sistema.
- `clientes` representa clientes registrados por el administrador.
- Un usuario registrado no debe aparecer automÃ¡ticamente como cliente.
- El administrador puede registrar clientes desde la vista Clientes.
- Los clientes se usan en deudas, pagos, prÃ©stamos y cobros.

Se agregÃ³ vista de administraciÃ³n de usuarios solo para administradores:

- Listar usuarios.
- Activar/desactivar usuarios.
- Editar usuarios.
- EliminaciÃ³n lÃ³gica.
- Evitar operar sobre el propio usuario.
- Configurar permisos por usuario.

Se agregÃ³ sistema de permisos por mÃ³dulo:

- Ver.
- Crear.
- Editar.
- Eliminar.
- Exportar.

El modal de permisos fue rediseÃ±ado con cards por mÃ³dulo y checkboxes visuales para que vaya acorde al diseÃ±o del sistema.

Script relacionado:

- `supabase/sql/PERMISOS-AUDITORIA-AVANZADA.sql`

## 6. MÃ³dulos financieros implementados o corregidos

### Dashboard

Se mejorÃ³ con:

- Cards principales.
- Balance de cuentas.
- Pendiente por cobrar.
- Pagos del mes.
- Ingresos / egresos.
- GrÃ¡ficos simples dentro de las cards.
- Deudas por vencer.
- Ãšltimos pagos.
- Alertas de presupuesto.
- Metas prÃ³ximas.
- ConfiguraciÃ³n de cards visibles.

### Clientes

Se agregÃ³ o corrigiÃ³:

- Registro de clientes.
- EdiciÃ³n y eliminaciÃ³n.
- SeparaciÃ³n correcta entre clientes y usuarios.
- PaginaciÃ³n.
- Uso en combos financieros.

### Cuentas bancarias

Se ajustÃ³ para:

- Mostrar cuentas como cards.
- Editar/eliminar desde la card.
- Quitar tabla innecesaria.
- Registrar transferencias entre cuentas propias.
- Registrar transferencias hacia otras cuentas.
- Actualizar saldos segÃºn movimientos.

### Deudas por cobrar

Se redefiniÃ³ la lÃ³gica:

- Son deudas que un cliente tiene conmigo.
- No descuentan una cuenta al crearse.
- Se consideran pendientes por cobrar.
- Cuando el cliente paga, se registra un pago/cobro y eso aumenta la cuenta bancaria.

### Pagos / cobros generales

Se corrigiÃ³ la lÃ³gica:

- Un pago recibido de cliente es ingreso.
- Debe aumentar la cuenta bancaria.
- Se agregÃ³ relaciÃ³n con cuenta bancaria.
- Se agregÃ³ ediciÃ³n y eliminaciÃ³n para corregir operaciones.

### PrÃ©stamos otorgados

Se separÃ³ de deudas:

- Representa dinero que yo presto a un cliente.
- Al registrar un prÃ©stamo otorgado, debe contar como egreso si sale de una cuenta.
- El cobro de ese prÃ©stamo cuenta como ingreso.

### Cobros de prÃ©stamos

Se agregÃ³ vista para registrar pagos recibidos por prÃ©stamos otorgados.

### PrÃ©stamos recibidos

Se agregÃ³ lÃ³gica para dinero que me prestaron a mÃ­:

- Acreedor: persona, entidad o empresa que me prestÃ³ dinero.
- Si el dinero ya no estÃ¡ en cuenta porque fue hace meses, se puede registrar como deuda histÃ³rica sin afectar saldo actual.
- Si el dinero entra a una cuenta, puede registrarse afectando saldo.

### Pagos de prÃ©stamos recibidos

Se agregÃ³ vista para registrar pagos que hago a mis acreedores.

### Ingresos / egresos

Se agregÃ³:

- Movimiento tipo ingreso o egreso.
- SelecciÃ³n de cuenta bancaria afectada.
- CategorÃ­as/tipos de movimiento.
- Mantenimiento de tipos de ingreso/egreso.
- Egresos como servicios, plataformas, proveedores.
- Ingresos como pago empresa, pago extra, etc.

### Presupuestos

Se agregÃ³ control mensual de presupuestos por categorÃ­a/tipo.

### Metas

Se agregÃ³ control de metas financieras.

## 7. Reportes, backup y auditorÃ­a

### Reportes

Se corrigiÃ³ exportaciÃ³n:

- CSV.
- JSON.
- PDF imprimible desde navegador.
- Filtros por fecha.
- Resumen por cliente.
- Resumen por ingresos/egresos.

### Backup

Se agregÃ³:

- ExportaciÃ³n de informaciÃ³n.
- ImportaciÃ³n CSV/XLSX.
- Dependencia `xlsx`.

### AuditorÃ­a

Se agregÃ³:

- Registro de acciones importantes.
- FunciÃ³n avanzada `registrar_auditoria_avanzada`.
- Consulta de auditorÃ­a.
- Filtros.

## 8. PWA y publicaciÃ³n

Se agregÃ³ soporte para app instalable:

- Manifest.
- Service worker.
- PÃ¡gina offline.
- BotÃ³n "Instalar app".
- DetecciÃ³n de actualizaciÃ³n disponible.
- Compatibilidad bÃ¡sica para Vercel.

TambiÃ©n se corrigiÃ³ el problema de que en Vercel volvÃ­a a pedir Supabase, indicando que las variables deben configurarse en Production, no solo Development.

Variables esperadas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 9. DiseÃ±o web y mÃ³vil

Se trabajÃ³ en:

- MenÃº lateral web.
- OpciÃ³n para ocultar/mostrar menÃº en web.
- MenÃº inferior mÃ³vil.
- CorrecciÃ³n de scroll lateral.
- Uso de pantalla completa en vistas generales.
- Perfil y configuraciÃ³n centrados.
- Cards mÃ¡s limpias.
- Modales para guardar/editar.
- Alertas personalizadas en lugar de alerts del navegador.
- Estados visuales de carga al ingresar, guardar, borrar, eliminar y descargar.
- BotÃ³n de cerrar sesiÃ³n visible en mÃ³vil.
- RediseÃ±o de Mi perfil para web y mÃ³vil.
- CorrecciÃ³n de botones tapados por menÃº inferior mÃ³vil.
- RediseÃ±o de iconos de notificaciones y ocultar menÃº.

## 10. Scripts SQL importantes

Scripts principales en `supabase/sql`:

- `supabase-schema.sql`: esquema base.
- `PERFIL-SCHEMA.sql`: columnas de perfil.
- `PIN-MOVIL-SCHEMA.sql`: PIN mÃ³vil.
- `MOVIMIENTOS-SCHEMA.sql`: movimientos.
- `TIPOS-MOVIMIENTO-SCHEMA.sql`: tipos de ingreso/egreso.
- `MOVIMIENTOS-CUENTAS-SCHEMA.sql`: movimientos asociados a cuentas.
- `TRANSFERENCIAS-SCHEMA.sql`: transferencias.
- `DEUDAS-PRESTAMOS-SCHEMA.sql`: deudas y prÃ©stamos.
- `PRESTAMOS-RECIBIDOS-SCHEMA.sql`: prÃ©stamos recibidos.
- `REPARAR-RPC-PAGOS.sql`: funciÃ³n de pagos.
- `ADMIN-USUARIOS-SCHEMA.sql`: administraciÃ³n de usuarios.
- `PERMISOS-AUDITORIA-AVANZADA.sql`: permisos, auditorÃ­a avanzada y storage.

## 11. Validaciones realizadas

Se ejecutÃ³ build varias veces:

```bash
npm run build
```

El build terminÃ³ correctamente despuÃ©s de los cambios recientes.

## 12. Pendientes tÃ©cnicos importantes

### Alta prioridad

1. Separar `src/main.jsx` en vistas independientes.

   Estado: realizado.

   Las vistas quedaron en:

   - `src/pages/Dashboard.jsx`
   - `src/pages/Perfil.jsx`
   - `src/pages/Config.jsx`
   - `src/pages/finance/*.jsx`
2. Crear una capa real de servicios por entidad.

   Ejemplo:

   - `src/services/clientes.service.js`
   - `src/services/cuentas.service.js`
   - `src/services/deudas.service.js`
   - `src/services/prestamos.service.js`
   - `src/services/reportes.service.js`

3. Revisar todas las polÃ­ticas RLS en Supabase.

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

   Las operaciones que cambian dinero deberÃ­an ejecutarse con RPCs atÃ³micas para evitar inconsistencias:

   - registrar pago.
   - editar pago.
   - eliminar pago.
   - registrar egreso.
   - editar egreso.
   - eliminar egreso.
   - transferencias.
   - prÃ©stamo otorgado.
   - cobro de prÃ©stamo.
   - prÃ©stamo recibido.
   - pago de prÃ©stamo recibido.

5. Crear pruebas manuales o automatizadas por flujo financiero.

   Flujos mÃ­nimos:

   - crear cuenta.
   - crear cliente.
   - crear deuda.
   - registrar pago de deuda.
   - editar pago.
   - eliminar pago.
   - registrar prÃ©stamo otorgado.
   - cobrar prÃ©stamo.
   - registrar prÃ©stamo recibido histÃ³rico.
   - pagar prÃ©stamo recibido.
   - registrar ingreso.
   - registrar egreso.
   - transferir entre cuentas.

### Prioridad media

6. Mejorar dashboard con grÃ¡ficos mÃ¡s completos.

   Posibles grÃ¡ficos:

   - Ingresos vs egresos por mes.
   - Saldos por cuenta.
   - Top clientes con deuda.
   - CategorÃ­as con mayor gasto.
   - EvoluciÃ³n de patrimonio.

7. Agregar filtros avanzados en todas las tablas.

   Ejemplo:

   - fecha desde/hasta.
   - cliente.
   - cuenta.
   - estado.
   - tipo.
   - monto mÃ­nimo/mÃ¡ximo.

8. Agregar exportaciÃ³n PDF por mÃ³dulo.

   Ya existe exportaciÃ³n en reportes, pero faltarÃ­a por mÃ³dulo:

   - clientes.
   - cuentas.
   - deudas.
   - pagos.
   - prÃ©stamos.
   - movimientos.

9. Mejorar importaciones.

   Pendiente:

   - ValidaciÃ³n previa antes de importar.
   - Vista de errores por fila.
   - Plantillas descargables CSV/XLSX.

10. Mejorar auditorÃ­a.

   Pendiente:

   - Mostrar antes/despuÃ©s de cambios.
   - Filtros por usuario.
   - Exportar auditorÃ­a.
   - Registrar IP/user agent si es necesario.

### Prioridad baja

11. Notificaciones internas mÃ¡s completas.

   Posibles alertas:

   - Deudas vencidas.
   - Presupuestos superados.
   - Metas vencidas.
   - Saldos bajos.
   - PrÃ©stamos por cobrar.
   - Pagos prÃ³ximos.

12. Modo oscuro.

13. PersonalizaciÃ³n visual.

   - Logo desde configuraciÃ³n.
   - Colores de marca.
   - Nombre de empresa.
   - Datos para reportes.

14. Multi-moneda real.

   Actualmente hay campo moneda, pero falta:

   - Tipo de cambio.
   - ConversiÃ³n.
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

## 13. RecomendaciÃ³n de siguiente paso

Antes de agregar mÃ¡s funciones nuevas, conviene hacer una limpieza tÃ©cnica:

1. Crear servicios por entidad.
2. Revisar RLS y RPCs financieras.
3. Hacer pruebas flujo por flujo.

Eso va a dejar el proyecto mÃ¡s estable para seguir creciendo sin romper funcionalidades ya terminadas.

## 14. Cierre de ordenamiento tecnico

Estado aplicado:

- `src/main.jsx` quedo reducido a orquestacion de sesion, layout, navegacion interna, busqueda global y alertas.
- Las vistas principales se separaron en archivos propios:
  - `src/pages/Dashboard.jsx`
  - `src/pages/Perfil.jsx`
  - `src/pages/Config.jsx`
  - `src/pages/finance/*.jsx`
- Las utilidades compartidas de paginas financieras quedaron en `src/pages/finance/financePageShared.jsx`.
- Los componentes base quedaron concentrados en `src/components/ui.jsx`.
- La autenticacion quedo separada en `src/components/auth/Auth.jsx`.
- El layout quedo separado en `src/components/layout/AppLayout.jsx`.
- La configuracion visual quedo separada en `src/config/visualConfig.js`.
- El CSS quedo modularizado en `src/styles/`.
- Los archivos SQL estan ordenados en `supabase/sql/`.
- Los documentos de analisis y pendientes estan ordenados en `docs/`, `docs/analisis/` y `docs/pendientes/`.

Validacion:

- `npm run build` ejecutado correctamente despues del ordenamiento final.
- Queda solo una advertencia normal de Vite por tamano de chunk. No bloquea publicacion.
