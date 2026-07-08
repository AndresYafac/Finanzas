import { today } from '../utils/format';

export function buildReportFilters(filters = {}) {
  return {
    desde: filters.desde || `${today().slice(0, 7)}-01`,
    hasta: filters.hasta || today(),
    cliente_id: filters.cliente_id || '',
    cuenta_id: filters.cuenta_id || '',
    tipo: filters.tipo || '',
    estado: filters.estado || '',
  };
}

export function printHtmlReport(title, html) {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><title>${title}</title></head><body>${html}</body></html>`);
  win.document.close();
  win.print();
  return true;
}

export function listReportesData(supabase, adminId) {
  return Promise.all([
    supabase.from('deudas').select('*,clientes(nombre,apellido)').eq('admin_id', adminId),
    supabase.from('movimientos').select('*,tipos_movimiento(nombre)').eq('admin_id', adminId),
    supabase.from('presupuestos').select('*,tipos_movimiento(nombre)').eq('admin_id', adminId),
    supabase.from('metas').select('*').eq('admin_id', adminId),
    supabase.from('clientes').select('id,nombre,apellido').eq('admin_id', adminId).order('nombre'),
    supabase.from('cuentas').select('id,banco,tipo,saldo,moneda').eq('admin_id', adminId).order('banco'),
    supabase.from('tipos_movimiento').select('id,nombre,tipo').eq('admin_id', adminId).order('nombre'),
  ]);
}
