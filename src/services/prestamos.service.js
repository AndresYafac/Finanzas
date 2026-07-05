import { createEntityService } from './entity.service';

export const prestamosOtorgadosService = createEntityService('deudas');
export const prestamosRecibidosService = createEntityService('prestamos_recibidos');
export const pagosPrestamosRecibidosService = createEntityService('pagos_prestamos_recibidos');

export function listPrestamosOtorgadosViewData(supabase, adminId) {
  return Promise.all([
    supabase.from('deudas').select('*,clientes(nombre,apellido),cuentas(banco,tipo)').eq('admin_id', adminId).eq('tipo', 'Préstamo').order('fecha_inicio', { ascending: false }),
    supabase.from('clientes').select('*').eq('admin_id', adminId).order('nombre'),
    supabase.from('cuentas').select('*').eq('admin_id', adminId).order('banco'),
  ]);
}

export function listCobrosPrestamosViewData(supabase, adminId) {
  return Promise.all([
    supabase.from('pagos').select('*,clientes(nombre,apellido),deudas(descripcion,tipo),cuentas(banco)').eq('admin_id', adminId).order('fecha', { ascending: false }),
    supabase.from('clientes').select('*').eq('admin_id', adminId).order('nombre'),
    supabase.from('deudas').select('*,clientes(nombre,apellido)').eq('admin_id', adminId).eq('tipo', 'Préstamo'),
    supabase.from('cuentas').select('*').eq('admin_id', adminId).order('banco'),
  ]);
}

export function listPrestamosRecibidosViewData(supabase, adminId) {
  return Promise.all([
    supabase.from('prestamos_recibidos').select('*,cuentas(banco,tipo)').eq('admin_id', adminId).order('fecha_inicio', { ascending: false }),
    supabase.from('cuentas').select('*').eq('admin_id', adminId).order('banco'),
  ]);
}

export function listPagosPrestamosRecibidosViewData(supabase, adminId) {
  return Promise.all([
    supabase.from('pagos_prestamos_recibidos').select('*,prestamos_recibidos(acreedor,descripcion),cuentas(banco)').eq('admin_id', adminId).order('fecha', { ascending: false }),
    supabase.from('prestamos_recibidos').select('*').eq('admin_id', adminId).order('fecha_inicio', { ascending: false }),
    supabase.from('cuentas').select('*').eq('admin_id', adminId).order('banco'),
  ]);
}

export function registrarPrestamoOtorgado(supabase, payload) {
  return supabase.rpc('registrar_deuda_con_desembolso', { ...payload, p_tipo: 'Préstamo', p_desembolsar: true });
}

export function actualizarPrestamoOtorgado(supabase, deudaId, payload) {
  return supabase.rpc('actualizar_prestamo', { p_deuda_id: deudaId, ...payload });
}

export function eliminarPrestamoOtorgado(supabase, deudaId) {
  return supabase.rpc('eliminar_prestamo', { p_deuda_id: deudaId });
}

export function registrarPrestamoRecibido(supabase, payload) {
  return supabase.rpc('registrar_prestamo_recibido', payload);
}

export function actualizarPrestamoRecibido(supabase, prestamoId, payload) {
  return supabase.rpc('actualizar_prestamo_recibido', { p_prestamo_id: prestamoId, ...payload });
}

export function eliminarPrestamoRecibido(supabase, prestamoId) {
  return supabase.rpc('eliminar_prestamo_recibido', { p_prestamo_id: prestamoId });
}

export function registrarPagoPrestamoRecibido(supabase, payload) {
  return supabase.rpc('registrar_pago_prestamo_recibido', payload);
}

export function actualizarPagoPrestamoRecibido(supabase, pagoId, payload) {
  return supabase.rpc('actualizar_pago_prestamo_recibido', { p_pago_id: pagoId, ...payload });
}

export function eliminarPagoPrestamoRecibido(supabase, pagoId) {
  return supabase.rpc('eliminar_pago_prestamo_recibido', { p_pago_id: pagoId });
}
