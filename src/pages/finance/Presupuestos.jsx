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
import { createPresupuesto, deletePresupuesto, listPresupuestosViewData, updatePresupuesto } from '../../services/presupuestos.service';
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

export function Presupuestos({ supabase, user, can = () => true }) {
  const emptyForm = { mes: month(), tipo: 'egreso', tipo_movimiento_id: '', categoria: '', monto_limite: '', notas: '' };
  const [rows, setRows] = React.useState([]);
  const [tipos, setTipos] = React.useState([]);
  const [movimientos, setMovimientos] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(async () => {
    const [presupuestos, tiposData, movimientosData] = await listPresupuestosViewData(supabase, user.id);
    setRows(presupuestos.data || []);
    setTipos(tiposData.data || []);
    setMovimientos(movimientosData.data || []);
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      mes: row.mes || month(),
      tipo: row.tipo || 'egreso',
      tipo_movimiento_id: row.tipo_movimiento_id || '',
      categoria: row.categoria || '',
      monto_limite: row.monto_limite ?? '',
      notas: row.notas || '',
    });
    setOpen(true);
  }
  async function remove(row) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar presupuesto ${row.categoria || row.tipos_movimiento?.nombre || ''}?`))) return;
    const { error } = await deletePresupuesto(supabase, user.id, row.id);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'presupuestos', 'delete', 'Presupuesto eliminado', row.id, row);
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
    const selected = tipos.find((t) => t.id === form.tipo_movimiento_id);
    const payload = {
      ...form,
      admin_id: user.id,
      tipo_movimiento_id: form.tipo_movimiento_id || null,
      categoria: selected?.nombre || form.categoria,
      monto_limite: Number(form.monto_limite || 0),
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await updatePresupuesto(supabase, user.id, editingId, payload)
      : await createPresupuesto(supabase, payload);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'presupuestos', editingId ? 'update' : 'insert', editingId ? 'Presupuesto actualizado' : 'Presupuesto creado', editingId, payload);
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    load();
  }
  const tipoOptions = tipos.filter((t) => t.tipo === form.tipo);
  function usage(row) {
    const used = movimientos
      .filter((m) => m.fecha?.startsWith(row.mes) && m.tipo === row.tipo)
      .filter((m) => (row.tipo_movimiento_id && m.tipo_movimiento_id === row.tipo_movimiento_id) || (!row.tipo_movimiento_id && (m.categoria || '') === (row.categoria || '')))
      .reduce((sum, m) => sum + Number(m.monto || 0), 0);
    const limit = Number(row.monto_limite || 0);
    return { used, pct: limit ? Math.min(999, Math.round((used / limit) * 100)) : 0 };
  }
  return (
    <>
      <TableSection
        title="Presupuestos"
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo presupuesto</button>}
        columns={['Mes', 'Tipo', 'Categoría', 'Límite', 'Usado', 'Avance']}
        rows={rows.map((row) => {
          const u = usage(row);
          return [row.mes, badge(row.tipo), row.tipos_movimiento?.nombre || row.categoria || '-', money(row.monto_limite), money(u.used), <div className="progress-cell"><div className="progress-bar"><span style={{ width: `${Math.min(100, u.pct)}%` }} /></div><b>{u.pct}%</b></div>, <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(row)} onDelete={() => remove(row)} />];
        })}
      />
      <Modal open={open} title={editingId ? 'Editar presupuesto' : 'Nuevo presupuesto'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="form-row">
              <Field label="Mes" type="month" value={form.mes} onChange={(v) => setForm({ ...form, mes: v })} required />
              <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v, tipo_movimiento_id: '' })}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></SelectField>
            </div>
            <SelectField label="Tipo de movimiento" value={form.tipo_movimiento_id} onChange={(v) => setForm({ ...form, tipo_movimiento_id: v })}>
              <option value="">Usar categoría manual...</option>
              {tipoOptions.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </SelectField>
            <Field label="Categoría manual" value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })} placeholder="Servicios, plataformas, proveedor..." />
            <Field label="Monto límite" type="number" value={form.monto_limite} onChange={(v) => setForm({ ...form, monto_limite: v })} required />
            <Field label="Notas" value={form.notas} onChange={(v) => setForm({ ...form, notas: v })} />
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
    </>
  );
}

