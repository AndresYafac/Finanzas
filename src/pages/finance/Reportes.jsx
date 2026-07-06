import React from 'react';
import {
  ArrowRightLeft,
  Building2,
  Check,
  ClipboardList,
  FileDown,
  Pencil,
  Plus,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Badge, Field, Modal, RowActions, SelectField, TableSection } from '../../components/ui';
import { confirmAction, notify } from '../../services/feedback';
import { listReportesData } from '../../services/reportes.service';
import { calcEstado, dateFmt, money, month, today } from '../../utils/format';
import {
  MODULE_PERMISSIONS,
  PERMISSION_FIELDS,
  MetricCard,
  badge,
  downloadText,
  escapeHtml,
  logAudit,
  parseCsv,
  shortJson,
  toCsv,
} from './financePageShared';

export function Reportes({ supabase, user, can = () => true }) {
  const [rows, setRows] = React.useState([]);
  const [movimientos, setMovimientos] = React.useState([]);
  const [presupuestos, setPresupuestos] = React.useState([]);
  const [metas, setMetas] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [tipos, setTipos] = React.useState([]);
  const defaultFilters = React.useCallback(() => ({
    desde: `${month()}-01`,
    hasta: today(),
    cliente_id: '',
    cuenta_id: '',
    tipo: '',
    tipo_movimiento_id: '',
  }), []);
  const [filters, setFilters] = React.useState(defaultFilters);
  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  React.useEffect(() => {
    listReportesData(supabase, user.id).then(([deudasData, movimientosData, presupuestosData, metasData, clientesData, cuentasData, tiposData]) => {
      setRows(deudasData.data || []);
      setMovimientos(movimientosData.data || []);
      setPresupuestos(presupuestosData.data || []);
      setMetas(metasData.data || []);
      setClientes(clientesData.data || []);
      setCuentas(cuentasData.data || []);
      setTipos(tiposData.data || []);
    });
  }, [supabase, user.id]);
  const inDateRange = (fecha) => (!filters.desde || fecha >= filters.desde) && (!filters.hasta || fecha <= filters.hasta);
  const filteredRows = rows.filter((d) => (
    (!filters.cliente_id || d.cliente_id === filters.cliente_id) &&
    (!filters.desde || (d.fecha_inicio || d.created_at || '').slice(0, 10) >= filters.desde) &&
    (!filters.hasta || (d.fecha_inicio || d.created_at || '').slice(0, 10) <= filters.hasta)
  ));
  const filteredMovimientos = movimientos.filter((m) => (
    inDateRange(m.fecha) &&
    (!filters.cuenta_id || m.cuenta_id === filters.cuenta_id) &&
    (!filters.tipo || m.tipo === filters.tipo) &&
    (!filters.tipo_movimiento_id || m.tipo_movimiento_id === filters.tipo_movimiento_id)
  ));
  const summary = filteredRows.reduce((map, d) => {
    const name = `${d.clientes?.nombre || ''} ${d.clientes?.apellido || ''}`;
    map[name] ||= { total: 0, pagado: 0 };
    map[name].total += Number(d.monto_total || 0);
    map[name].pagado += Number(d.monto_pagado || 0);
    return map;
  }, {});
  const tableRows = Object.entries(summary).map(([name, r]) => [name, money(r.total), money(r.pagado), money(r.total - r.pagado), r.total - r.pagado <= 0 ? badge('pagado') : badge('vencido')]);
  const exportClientesCsv = () => {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    const csvRows = Object.entries(summary).map(([cliente, r]) => ({
      cliente,
      cuenta_por_cobrar_total: Number(r.total || 0).toFixed(2),
      pagado: Number(r.pagado || 0).toFixed(2),
      saldo_por_cobrar: Number((r.total || 0) - (r.pagado || 0)).toFixed(2),
      estado: r.total - r.pagado <= 0 ? 'Cobrado' : 'Saldo por cobrar',
    }));
    downloadText(`fintrack-resumen-clientes-${today()}.csv`, toCsv(csvRows), 'text/csv');
  };
  const ingresos = filteredMovimientos.filter((m) => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto || 0), 0);
  const egresos = filteredMovimientos.filter((m) => m.tipo === 'egreso').reduce((sum, m) => sum + Number(m.monto || 0), 0);
  const movimientosPorTipo = filteredMovimientos.reduce((map, m) => {
    const key = `${m.tipo}:${m.tipos_movimiento?.nombre || m.categoria || 'Sin tipo'}`;
    map[key] ||= { tipo: m.tipo, categoria: m.tipos_movimiento?.nombre || m.categoria || 'Sin tipo', total: 0 };
    map[key].total += Number(m.monto || 0);
    return map;
  }, {});
  const filteredTipos = tipos.filter((tipo) => !filters.tipo || tipo.tipo === filters.tipo);
  const exportResumen = () => {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    return downloadText(`fintrack-reporte-${today()}.json`, JSON.stringify({
      filtros: filters,
      cuentas_por_cobrar: summary,
      movimientos: Object.values(movimientosPorTipo),
      presupuestos,
      metas,
    }, null, 2));
  };
  const exportPdf = () => {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    const company = getCompanyConfig();
    const movimientosRows = Object.values(movimientosPorTipo);
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Reporte FinTrack ${today()}</title>
          <style>
            body{font-family:Arial,sans-serif;color:#0f1923;margin:32px}
            .header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:2px solid #0f765f;padding-bottom:18px}
            .company{display:flex;gap:14px;align-items:center}
            .logo{width:58px;height:58px;border-radius:16px;object-fit:cover;background:#1d9e75}
            h1{margin:0 0 4px;font-size:24px} h2{font-size:16px;margin-top:24px}
            .muted{color:#60758a;font-size:12px;margin-bottom:20px}
            .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
            .card{border:1px solid #dce6ef;border-radius:14px;padding:14px}
            .label{color:#60758a;font-size:11px;text-transform:uppercase;font-weight:700}
            .value{font-size:20px;font-weight:800;margin-top:6px}
            table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
            th,td{border-bottom:1px solid #e1e9f0;padding:9px;text-align:left}
            th{background:#f3f7fa;color:#51677f;text-transform:uppercase;font-size:10px}
            @media print{button{display:none} body{margin:20px}}
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">
              ${company.logo_url ? `<img class="logo" src="${escapeHtml(company.logo_url)}" />` : '<div class="logo"></div>'}
              <div>
                <h1>${escapeHtml(company.nombre || 'FinTrack Pro')}</h1>
                <div class="muted">${escapeHtml(company.documento || '')}${company.direccion ? ` · ${escapeHtml(company.direccion)}` : ''}${company.telefono ? ` · ${escapeHtml(company.telefono)}` : ''}</div>
              </div>
            </div>
            <div class="muted">Generado: ${escapeHtml(new Date().toLocaleString('es-PE'))}<br/>Desde ${escapeHtml(filters.desde || '-')} hasta ${escapeHtml(filters.hasta || '-')}</div>
          </div>
          <div class="cards">
            <div class="card"><div class="label">Ingresos</div><div class="value">${escapeHtml(money(ingresos))}</div></div>
            <div class="card"><div class="label">Egresos</div><div class="value">${escapeHtml(money(egresos))}</div></div>
            <div class="card"><div class="label">Presupuestos</div><div class="value">${presupuestos.length}</div></div>
            <div class="card"><div class="label">Metas activas</div><div class="value">${metas.filter((m) => m.estado === 'activa').length}</div></div>
          </div>
          <h2>Resumen por cliente</h2>
          <table><thead><tr><th>Cliente</th><th>Total por cobrar</th><th>Cobrado</th><th>Saldo por cobrar</th></tr></thead><tbody>
            ${Object.entries(summary).map(([cliente, r]) => `<tr><td>${escapeHtml(cliente)}</td><td>${escapeHtml(money(r.total))}</td><td>${escapeHtml(money(r.pagado))}</td><td>${escapeHtml(money(r.total - r.pagado))}</td></tr>`).join('') || '<tr><td colspan="4">Sin datos</td></tr>'}
          </tbody></table>
          <h2>Ingresos y egresos por tipo</h2>
          <table><thead><tr><th>Tipo</th><th>Categoría</th><th>Total</th></tr></thead><tbody>
            ${movimientosRows.map((row) => `<tr><td>${escapeHtml(row.tipo)}</td><td>${escapeHtml(row.categoria)}</td><td>${escapeHtml(money(row.total))}</td></tr>`).join('') || '<tr><td colspan="3">Sin datos</td></tr>'}
          </tbody></table>
          <script>window.onload=()=>{window.print();}</script>
        </body>
      </html>`;
    const win = window.open('', '_blank');
    if (!win) return notify('El navegador bloqueó la ventana del PDF. Permite ventanas emergentes para exportar.');
    win.document.write(html);
    win.document.close();
  };
  return (
    <>
      <div className="card report-filters">
        <div className="card-header">
          <h3>Filtros del reporte</h3>
        </div>
        <div className="card-body">
          <div className="report-filter-grid">
            <Field label="Desde" type="date" value={filters.desde} onChange={(value) => setFilter('desde', value)} />
            <Field label="Hasta" type="date" value={filters.hasta} onChange={(value) => setFilter('hasta', value)} />
            <SelectField label="Cliente" value={filters.cliente_id} onChange={(value) => setFilter('cliente_id', value)}>
              <option value="">Todos los clientes</option>
              {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre} {cliente.apellido}</option>)}
            </SelectField>
            <SelectField label="Cuenta" value={filters.cuenta_id} onChange={(value) => setFilter('cuenta_id', value)}>
              <option value="">Todas las cuentas</option>
              {cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.banco} {cuenta.tipo ? `- ${cuenta.tipo}` : ''}</option>)}
            </SelectField>
            <SelectField label="Tipo" value={filters.tipo} onChange={(value) => setFilters((current) => ({ ...current, tipo: value, tipo_movimiento_id: '' }))}>
              <option value="">Ingresos y egresos</option>
              <option value="ingreso">Solo ingresos</option>
              <option value="egreso">Solo egresos</option>
            </SelectField>
            <SelectField label="Categoría" value={filters.tipo_movimiento_id} onChange={(value) => setFilter('tipo_movimiento_id', value)}>
              <option value="">Todas las categorías</option>
              {filteredTipos.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
            </SelectField>
          </div>
          <div className="filter-actions">
            <button className="btn" type="button" onClick={() => setFilters(defaultFilters())}>Limpiar filtros</button>
          </div>
        </div>
      </div>
      <div className="metrics-grid">
        <MetricCard icon={<TrendingUp />} label="Ingresos filtrados" value={money(ingresos)} helper={`${filteredMovimientos.filter((m) => m.tipo === 'ingreso').length} movimientos`} />
        <MetricCard icon={<TrendingDown />} label="Egresos filtrados" value={money(egresos)} helper={`${filteredMovimientos.filter((m) => m.tipo === 'egreso').length} movimientos`} danger />
        <MetricCard icon={<ClipboardList />} label="Presupuestos" value={presupuestos.length} helper="Controles configurados" />
        <MetricCard icon={<Target />} label="Metas activas" value={metas.filter((m) => m.estado === 'activa').length} helper={`${metas.length} metas registradas`} />
      </div>
      <div className="action-bar"><div /><div className="table-actions">{can('export') && <button className="btn" onClick={exportPdf}><FileDown size={16} />Exportar PDF</button>}{can('export') && <button className="btn btn-primary" onClick={exportResumen}><FileDown size={16} />Exportar reporte JSON</button>}</div></div>
      <TableSection title="Resumen por cliente" columns={['Cliente', 'Total por cobrar', 'Cobrado', 'Saldo por cobrar', 'Estado']} rows={tableRows} onExport={can('export') ? exportClientesCsv : null} />
      <div className="report-spacer" />
      <TableSection title="Ingresos y egresos por tipo" columns={['Tipo', 'Categoría', 'Total']} rows={Object.values(movimientosPorTipo).map((row) => [badge(row.tipo), row.categoria, money(row.total)])} />
    </>
  );
}


