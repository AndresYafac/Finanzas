import { createEntityService } from './entity.service';
import { validateFinanceOperationIfAvailable } from './backend.service';

export const cuentasService = createEntityService('cuentas');

export async function getCuentasViewData(supabase, adminId) {
  const [cuentas, transferencias, movimientos, pagos] = await Promise.all([
    supabase.from('cuentas').select('*').eq('admin_id', adminId).order('created_at', { ascending: false }),
    supabase.from('transferencias').select('*').eq('admin_id', adminId).order('fecha', { ascending: false }).limit(10),
    supabase.from('movimientos').select('id,fecha,tipo,concepto,monto,cuenta_id').eq('admin_id', adminId).order('fecha', { ascending: false }).limit(80),
    supabase.from('pagos').select('id,fecha,monto,metodo,cuenta_id,clientes(nombre,apellido)').eq('admin_id', adminId).order('fecha', { ascending: false }).limit(80),
  ]);

  return {
    cuentas: cuentas.data || [],
    transferencias: transferencias.data || [],
    movimientos: movimientos.data || [],
    pagos: pagos.data || [],
  };
}

export function createCuenta(supabase, adminId, payload) {
  return supabase.from('cuentas').insert({ ...payload, admin_id: adminId });
}

export function updateCuenta(supabase, adminId, id, payload) {
  return supabase.from('cuentas').update(payload).eq('id', id).eq('admin_id', adminId);
}

export function deleteCuenta(supabase, adminId, id) {
  return supabase.from('cuentas').delete().eq('id', id).eq('admin_id', adminId);
}

export async function registrarTransferencia(supabase, payload) {
  const validation = await validateFinanceOperationIfAvailable(supabase, {
    operation: 'transferencia',
    monto: payload.p_monto,
    cuenta_origen_id: payload.p_cuenta_origen_id,
    cuenta_destino_id: payload.p_cuenta_destino_id,
  });
  if (validation.error || validation.data?.ok === false) return validation;

  return supabase.rpc('registrar_transferencia', payload);
}

export function listarCuentasActivas(supabase, adminId) {
  return supabase
    .from('cuentas')
    .select('*')
    .eq('admin_id', adminId)
    .order('banco', { ascending: true });
}

export function isLinkedWallet(cuenta) {
  return cuenta?.tipo_entidad === 'billetera' && Boolean(cuenta.cuenta_vinculada_id);
}

export function getOperationalAccounts(cuentas = []) {
  return cuentas.filter((cuenta) => !isLinkedWallet(cuenta));
}

export function sumOperationalBalances(cuentas = []) {
  return getOperationalAccounts(cuentas).reduce((sum, cuenta) => sum + Number(cuenta.saldo || 0), 0);
}
