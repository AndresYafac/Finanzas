import { month, today } from '../utils/format';

export async function getDashboardData(supabase, adminId) {
  const [deudas, pagos, cuentas, movimientos, presupuestos, metas] = await Promise.all([
    supabase.from('deudas').select('*,clientes(nombre,apellido)').eq('admin_id', adminId),
    supabase.from('pagos').select('*,clientes(nombre,apellido),deudas(descripcion)').eq('admin_id', adminId).order('fecha', { ascending: false }).limit(30),
    supabase.from('cuentas').select('*').eq('admin_id', adminId),
    supabase.from('movimientos').select('*').eq('admin_id', adminId),
    supabase.from('presupuestos').select('*,tipos_movimiento(nombre)').eq('admin_id', adminId).eq('mes', month()),
    supabase.from('metas').select('*').eq('admin_id', adminId).order('fecha_objetivo', { ascending: true }),
  ]);

  return {
    deudas: deudas.data || [],
    pagos: pagos.data || [],
    cuentas: cuentas.data || [],
    movimientos: movimientos.data || [],
    presupuestos: presupuestos.data || [],
    metas: metas.data || [],
  };
}

export async function getAlertData(supabase, adminId) {
  const [deudas, presupuestos, movimientos, metas, cuentas, prestamosRecibidos] = await Promise.all([
    supabase.from('deudas').select('id,descripcion,fecha_vencimiento,monto_total,monto_pagado,tipo,clientes(nombre,apellido)').eq('admin_id', adminId),
    supabase.from('presupuestos').select('id,categoria,tipo,monto_limite,tipo_movimiento_id,tipos_movimiento(nombre)').eq('admin_id', adminId).eq('mes', month()),
    supabase.from('movimientos').select('id,tipo,categoria,tipo_movimiento_id,monto,fecha').eq('admin_id', adminId).gte('fecha', `${month()}-01`).lte('fecha', today()),
    supabase.from('metas').select('id,nombre,monto_objetivo,monto_actual,fecha_objetivo,estado').eq('admin_id', adminId).eq('estado', 'activa'),
    supabase.from('cuentas').select('id,banco,tipo,tipo_entidad,cuenta_vinculada_id,saldo,moneda').eq('admin_id', adminId),
    supabase.from('prestamos_recibidos').select('id,acreedor,descripcion,monto_original,saldo_inicial,monto_pagado,fecha_vencimiento').eq('admin_id', adminId),
  ]);

  return {
    deudas: deudas.data || [],
    presupuestos: presupuestos.data || [],
    movimientos: movimientos.data || [],
    metas: metas.data || [],
    cuentas: cuentas.data || [],
    prestamosRecibidos: prestamosRecibidos.data || [],
  };
}
