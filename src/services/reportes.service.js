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
