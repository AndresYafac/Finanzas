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
import { listAuditoria } from '../../services/auditoria.service';
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

export function Auditoria({ supabase, user, can = () => true }) {
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [action, setAction] = React.useState('');
  React.useEffect(() => {
    listAuditoria(supabase, user.id).then(({ data }) => setRows(data || []));
  }, [supabase, user.id]);
  const filtered = rows.filter((row) => {
    const text = `${row.tabla || ''} ${row.accion || ''} ${row.descripcion || ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!action || row.accion === action);
  });
  const exportCsv = () => {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    return downloadText(`fintrack-auditoria-${today()}.csv`, toCsv(filtered.map((row) => ({
    fecha: row.created_at ? new Date(row.created_at).toLocaleString('es-PE') : '',
    tabla: row.tabla,
    accion: row.accion,
    descripcion: row.descripcion,
    registro_id: row.registro_id,
    datos_antes: shortJson(row.datos_antes || (row.accion === 'delete' ? row.datos : null)),
    datos_despues: shortJson(row.datos_despues || (row.accion !== 'delete' ? row.datos : null)),
    }))), 'text/csv');
  };
  return (
    <>
      <div className="card report-filters"><div className="card-body audit-filters">
        <Field label="Buscar" value={query} onChange={setQuery} placeholder="Tabla, acción o descripción..." />
        <SelectField label="Acción" value={action} onChange={setAction}><option value="">Todas</option><option value="insert">Insertar</option><option value="update">Actualizar</option><option value="delete">Eliminar</option></SelectField>
        {can('export') && <button className="btn" type="button" onClick={exportCsv}><FileDown size={16} />Exportar auditoría</button>}
      </div></div>
      <TableSection title="Auditoría" columns={['Fecha', 'Tabla', 'Acción', 'Descripción', 'Datos']} rows={filtered.map((row) => [new Date(row.created_at).toLocaleString('es-PE'), row.tabla, row.accion, row.descripcion || '-', <code>{shortJson(row.datos_despues || row.datos_antes || row.datos)}</code>])} />
    </>
  );
}

