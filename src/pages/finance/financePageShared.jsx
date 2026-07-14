import React from 'react';
import { Badge } from '../../components/ui';
import { hideBusy, showBusy } from '../../services/feedback';

export function MetricCard({ icon, label, value, helper, danger = false }) {
  return (
    <div className={`metric-card ${danger ? 'danger' : ''}`}>
      <div className="metric-icon">{icon}</div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <small className="metric-helper">{helper}</small>
    </div>
  );
}
export const MODULE_PERMISSIONS = [
  ['dashboard', 'Dashboard'],
  ['clientes', 'Clientes'],
  ['cuentas', 'Cuentas y caja'],
  ['deudas', 'Cuentas por cobrar'],
  ['prestamos-recibidos', 'Préstamos por pagar'],
  ['pagos-prestamos-recibidos', 'Pagos a acreedores'],
  ['pagos', 'Cobros recibidos'],
  ['movimientos', 'Movimientos de caja'],
  ['caja-diaria', 'Caja diaria'],
  ['plantillas', 'Plantillas'],
  ['categorias-inteligentes', 'Categorias inteligentes'],
  ['presupuestos', 'Presupuestos'],
  ['metas', 'Metas'],
  ['cierre-mensual', 'Cierre mensual'],
  ['reportes', 'Reportes'],
  ['backup', 'Backup'],
  ['auditoria', 'Auditoría'],
];
export const PERMISSION_FIELDS = [
  ['can_view', 'Ver'],
  ['can_create', 'Crear'],
  ['can_edit', 'Editar'],
  ['can_delete', 'Eliminar'],
  ['can_export', 'Exportar'],
];


export function downloadText(filename, content, type = 'application/json') {
  showBusy('Descargando...');
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  window.setTimeout(() => hideBusy(), 350);
}
export function toCsv(rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n');
}
export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const parseLine = (line) => {
    const values = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values.map((value) => value.trim());
  };
  const headers = parseLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {});
  });
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}
export function shortJson(value) {
  if (!value) return '-';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}
export async function logAudit(supabase, userId, tabla, accion, descripcion, registro_id = null, datos = null) {
  const { error } = await supabase.rpc('registrar_auditoria_avanzada', {
    p_tabla: tabla,
    p_accion: accion,
    p_descripcion: descripcion,
    p_registro_id: registro_id,
    p_datos_antes: accion === 'delete' ? datos : null,
    p_datos_despues: accion === 'delete' ? null : datos,
  });
  if (error) {
    await supabase.from('auditoria').insert({ admin_id: userId, tabla, accion, descripcion, registro_id, datos });
  }
}

export function badge(estado) {
  const map = {
    al_dia: ['green', 'Al día'],
    por_vencer: ['yellow', 'Por vencer'],
    vencido: ['red', 'Vencido'],
    pagado: ['blue', 'Pagado'],
    ingreso: ['green', 'Ingreso'],
    egreso: ['red', 'Egreso'],
    activa: ['green', 'Activa'],
    completada: ['blue', 'Completada'],
    pausada: ['yellow', 'Pausada'],
  };
  const [tone, text] = map[estado] || ['gray', estado];
  return <Badge tone={tone}>{text}</Badge>;
}


