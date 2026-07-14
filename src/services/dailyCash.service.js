import { today } from '../utils/format';
import { sumOperationalBalances } from './cuentas.service';

export function listDailyCashSessions(supabase, adminId) {
  return supabase.from('daily_cash_sessions').select('*').eq('admin_id', adminId).order('fecha', { ascending: false });
}

export async function buildDailyCashSnapshot(supabase, adminId, fecha = today()) {
  const [cuentas, movimientos] = await Promise.all([
    supabase.from('cuentas').select('saldo,tipo_entidad,cuenta_vinculada_id').eq('admin_id', adminId),
    supabase.from('movimientos').select('tipo,monto,fecha').eq('admin_id', adminId).eq('fecha', fecha),
  ]);
  const rows = movimientos.data || [];
  const ingresos = rows.filter((item) => item.tipo === 'ingreso').reduce((sum, item) => sum + Number(item.monto || 0), 0);
  const egresos = rows.filter((item) => item.tipo === 'egreso').reduce((sum, item) => sum + Number(item.monto || 0), 0);
  const saldoFinal = sumOperationalBalances(cuentas.data || []);
  return {
    fecha,
    saldo_inicial: saldoFinal - ingresos + egresos,
    ingresos,
    egresos,
    saldo_final: saldoFinal,
  };
}

export function saveDailyCashSession(supabase, adminId, snapshot, estado = 'cerrada') {
  return supabase.from('daily_cash_sessions').upsert({
    ...snapshot,
    admin_id: adminId,
    estado,
    closed_at: estado === 'cerrada' ? new Date().toISOString() : null,
  }, { onConflict: 'admin_id,fecha' }).select().single();
}
