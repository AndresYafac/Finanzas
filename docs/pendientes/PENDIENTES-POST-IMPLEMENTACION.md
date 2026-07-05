# Pendientes post implementacion

Fecha: 2026-07-05

## Pendientes activos

1. Pruebas flujo por flujo.

   No se ejecuto por pedido del usuario.

   Flujos a validar:

   - Login por correo.
   - Login por PIN movil.
   - Crear/editar/eliminar clientes.
   - Crear/editar/eliminar cuentas.
   - Transferencias.
   - Deudas por cobrar.
   - Prestamos otorgados.
   - Cobros de prestamos.
   - Prestamos recibidos.
   - Pagos de prestamos recibidos.
   - Ingresos y egresos.
   - Presupuestos.
   - Metas.
   - Reportes.
   - Backup.
   - Auditoria.
   - Usuarios y permisos.

2. Ejecutar diagnostico RLS/RPC en Supabase.

   Archivo:

   - `supabase/sql/DIAGNOSTICO-RLS-RPC-CONSOLIDADO.sql`

   Este paso requiere ejecutar SQL dentro del panel de Supabase.

3. Mantener servicios por entidad al agregar nuevos modulos.

   Estado actual: las paginas principales ya consumen servicios.
   Las llamadas directas restantes estan en controladores/helpers internos de autenticacion, perfil, configuracion o auditoria.
   Si se agrega un nuevo modulo, primero debe crearse su servicio en `src/services`.

4. Revisar textos antiguos con caracteres rotos.

   Se creo un resumen tecnico limpio:

   - `docs/RESUMEN-TECNICO-ACTUALIZADO.md`

   Los documentos antiguos pueden conservar trazabilidad, pero algunos tienen caracteres heredados.
