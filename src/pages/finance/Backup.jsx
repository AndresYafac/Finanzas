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
import { exportTablesData, importRows } from '../../services/backup.service';
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

export function Backup({ supabase, user, can = () => true }) {
  const [status, setStatus] = React.useState('');
  const clientesFileRef = React.useRef(null);
  const movimientosFileRef = React.useRef(null);
  async function collectData() {
    const tables = ['profiles', 'clientes', 'cuentas', 'deudas', 'pagos', 'movimientos', 'tipos_movimiento', 'presupuestos', 'metas', 'auditoria'];
    return exportTablesData(supabase, user.id, tables);
  }
  async function exportJson() {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    setStatus('Preparando backup...');
    const data = await collectData();
    downloadText(`fintrack-backup-${today()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), user_id: user.id, data }, null, 2));
    setStatus('Backup JSON generado.');
  }
  async function exportCsv(table) {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    const data = await collectData();
    const rows = Array.isArray(data[table]) ? data[table] : [];
    downloadText(`fintrack-${table}-${today()}.csv`, toCsv(rows), 'text/csv');
    setStatus(`CSV de ${table} generado.`);
  }
  function downloadTemplate(type) {
    const content = type === 'clientes'
      ? 'nombre,apellido,tipo_doc,documento,telefono,email,direccion,notas\nJuan,Perez,DNI,12345678,999999999,juan@email.com,Direccion,Nota\n'
      : 'fecha,tipo,categoria,descripcion,monto\n2026-07-01,egreso,Servicios,Internet,120.00\n';
    downloadText(`plantilla-${type}.csv`, content, 'text/csv');
  }
  async function importCsvFile(event, type) {
    if (!can('create')) return notify('No tienes permiso para importar.');
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('Importando CSV...');
    let rows = [];
    if (file.name.toLowerCase().endsWith('.xlsx')) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
        .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).toLowerCase(), String(value)])));
    } else {
      rows = parseCsv(await file.text());
    }
    if (!rows.length) {
      setStatus('El archivo no tiene datos.');
      event.target.value = '';
      return;
    }
    const errors = [];
    const payload = rows.map((row, index) => {
      if (type === 'clientes') {
        const mapped = {
          admin_id: user.id,
          nombre: row.nombre || row.name || '',
          apellido: row.apellido || '',
          tipo_doc: row.tipo_doc || 'DNI',
          documento: row.documento || '',
          telefono: row.telefono || '',
          email: row.email || '',
          direccion: row.direccion || '',
          notas: row.notas || '',
        };
        if (!mapped.nombre) errors.push(`Fila ${index + 2}: falta nombre`);
        return mapped;
      }
      const monto = Number(String(row.monto || '0').replace(',', '.'));
      const mapped = {
        admin_id: user.id,
        fecha: row.fecha || today(),
        tipo: row.tipo === 'ingreso' ? 'ingreso' : 'egreso',
        categoria: row.categoria || 'Importado',
        descripcion: row.descripcion || row.detalle || 'Importado CSV',
        monto,
      };
      if (!mapped.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(mapped.fecha)) errors.push(`Fila ${index + 2}: fecha inválida`);
      if (!Number.isFinite(monto) || monto <= 0) errors.push(`Fila ${index + 2}: monto inválido`);
      return mapped;
    }).filter((row) => type === 'clientes' ? row.nombre : row.monto > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.fecha));
    if (!payload.length) {
      setStatus('No se encontraron filas válidas para importar.');
      event.target.value = '';
      return;
    }
    const { error } = await importRows(supabase, type, payload);
    if (error) setStatus(error.message);
    else setStatus(`${payload.length} registros importados en ${type}.${errors.length ? ` ${errors.length} filas omitidas: ${errors.slice(0, 3).join('; ')}` : ''}`);
    event.target.value = '';
  }
  return (
    <div className="grid-2">
      <div className="card"><div className="card-header"><h3>Backup completo</h3></div><div className="card-body">
        <p className="muted">Exporta una copia JSON con tus datos principales. Esto no restaura datos automáticamente; sirve como respaldo y auditoría.</p>
        {can('export') && <button className="btn btn-primary backup-button" onClick={exportJson}><FileDown size={16} />Descargar backup JSON</button>}
        {status && <div className="connection-status success">{status}</div>}
      </div></div>
      <div className="card"><div className="card-header"><h3>Exportar CSV</h3></div><div className="card-body backup-actions">
        {can('export') ? ['clientes', 'cuentas', 'deudas', 'pagos', 'movimientos', 'presupuestos', 'metas'].map((table) => <button key={table} className="btn" onClick={() => exportCsv(table)}><FileDown size={16} />{table}</button>) : <p className="muted">No tienes permiso para exportar.</p>}
      </div></div>
      <div className="card"><div className="card-header"><h3>Importar CSV</h3></div><div className="card-body backup-actions">
        <input ref={clientesFileRef} type="file" accept=".csv,.xlsx,text/csv" hidden onChange={(event) => importCsvFile(event, 'clientes')} />
        <input ref={movimientosFileRef} type="file" accept=".csv,.xlsx,text/csv" hidden onChange={(event) => importCsvFile(event, 'movimientos')} />
        <button className="btn" type="button" onClick={() => downloadTemplate('clientes')}><FileDown size={16} />Plantilla clientes</button>
        {can('create') && <button className="btn btn-primary" type="button" onClick={() => clientesFileRef.current?.click()}>Importar clientes</button>}
        <button className="btn" type="button" onClick={() => downloadTemplate('movimientos')}><FileDown size={16} />Plantilla movimientos</button>
        {can('create') && <button className="btn btn-primary" type="button" onClick={() => movimientosFileRef.current?.click()}>Importar movimientos</button>}
      </div></div>
    </div>
  );
}

