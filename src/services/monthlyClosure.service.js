import { month } from '../utils/format';
import { sumOperationalBalances } from './cuentas.service';

export function listMonthlyClosures(supabase, adminId) {
  return supabase.from('monthly_closures').select('*').eq('admin_id', adminId).order('mes', { ascending: false });
}

function monthEnd(selectedMonth) {
  const [year, monthNumber] = selectedMonth.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
}

export async function buildMonthlyClosureSnapshot(supabase, adminId, selectedMonth = month()) {
  const monthStart = `${selectedMonth}-01`;
  const selectedMonthEnd = monthEnd(selectedMonth);
  const [cuentas, movimientos, deudas, prestamos] = await Promise.all([
    supabase.from('cuentas').select('saldo,tipo_entidad,cuenta_vinculada_id').eq('admin_id', adminId),
    supabase.from('movimientos').select('tipo,monto,fecha').eq('admin_id', adminId).gte('fecha', monthStart).lte('fecha', selectedMonthEnd),
    supabase.from('deudas').select('monto_total,monto_pagado').eq('admin_id', adminId),
    supabase.from('prestamos_recibidos').select('monto_original,saldo_inicial,monto_pagado').eq('admin_id', adminId),
  ]);
  const movimientosData = movimientos.data || [];
  return {
    mes: selectedMonth,
    saldo_cuentas: sumOperationalBalances(cuentas.data || []),
    total_ingresos: movimientosData.filter((item) => item.tipo === 'ingreso').reduce((sum, item) => sum + Number(item.monto || 0), 0),
    total_egresos: movimientosData.filter((item) => item.tipo === 'egreso').reduce((sum, item) => sum + Number(item.monto || 0), 0),
    total_por_cobrar: (deudas.data || []).reduce((sum, item) => sum + Math.max(0, Number(item.monto_total || 0) - Number(item.monto_pagado || 0)), 0),
    total_por_pagar: (prestamos.data || []).reduce((sum, item) => sum + Math.max(0, Number(item.saldo_inicial || item.monto_original || 0) - Number(item.monto_pagado || 0)), 0),
  };
}

export function saveMonthlyClosure(supabase, adminId, userId, snapshot) {
  return supabase.from('monthly_closures').upsert({
    ...snapshot,
    admin_id: adminId,
    cerrado_por: userId,
  }, { onConflict: 'admin_id,mes' }).select().single();
}
