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
import { createMeta, deleteMeta, listMetas, updateMeta } from '../../services/metas.service';
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

export function Metas({ supabase, user, can = () => true }) {
  const emptyForm = { nombre: '', descripcion: '', monto_objetivo: '', monto_actual: '', fecha_objetivo: '', estado: 'activa' };
  const [rows, setRows] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(() => listMetas(supabase, user.id).then(({ data }) => setRows(data || [])), [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(row) {
    setEditingId(row.id);
    setForm({ nombre: row.nombre || '', descripcion: row.descripcion || '', monto_objetivo: row.monto_objetivo ?? '', monto_actual: row.monto_actual ?? '', fecha_objetivo: row.fecha_objetivo || '', estado: row.estado || 'activa' });
    setOpen(true);
  }
  async function remove(row) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar meta ${row.nombre || ''}?`))) return;
    const { error } = await deleteMeta(supabase, user.id, row.id);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'metas', 'delete', 'Meta eliminada', row.id, row);
    notify('Meta eliminada correctamente.', 'success');
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
    const payload = { ...form, admin_id: user.id, monto_objetivo: Number(form.monto_objetivo || 0), monto_actual: Number(form.monto_actual || 0), fecha_objetivo: form.fecha_objetivo || null, updated_at: new Date().toISOString() };
    const { error } = editingId
      ? await updateMeta(supabase, user.id, editingId, payload)
      : await createMeta(supabase, payload);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'metas', editingId ? 'update' : 'insert', editingId ? 'Meta actualizada' : 'Meta creada', editingId, payload);
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    notify(editingId ? 'Meta actualizada correctamente.' : 'Meta creada correctamente.', 'success');
    load();
  }
  return (
    <>
      <TableSection
        title="Metas financieras"
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva meta</button>}
        columns={['Meta', 'Objetivo', 'Actual', 'Avance', 'Fecha', 'Estado']}
        rows={rows.map((row) => {
          const pct = Number(row.monto_objetivo || 0) ? Math.round((Number(row.monto_actual || 0) / Number(row.monto_objetivo || 0)) * 100) : 0;
          return [row.nombre, money(row.monto_objetivo), money(row.monto_actual), <div className="progress-cell"><div className="progress-bar"><span style={{ width: `${Math.min(100, pct)}%` }} /></div><b>{pct}%</b></div>, dateFmt(row.fecha_objetivo), badge(row.estado), <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(row)} onDelete={() => remove(row)} />];
        })}
      />
      <Modal open={open} title={editingId ? 'Editar meta' : 'Nueva meta'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required />
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} />
            <div className="form-row">
              <Field label="Monto objetivo" type="number" value={form.monto_objetivo} onChange={(v) => setForm({ ...form, monto_objetivo: v })} required />
              <Field label="Monto actual" type="number" value={form.monto_actual} onChange={(v) => setForm({ ...form, monto_actual: v })} />
            </div>
            <div className="form-row">
              <Field label="Fecha objetivo" type="date" value={form.fecha_objetivo} onChange={(v) => setForm({ ...form, fecha_objetivo: v })} />
              <SelectField label="Estado" value={form.estado} onChange={(v) => setForm({ ...form, estado: v })}><option value="activa">Activa</option><option value="completada">Completada</option><option value="pausada">Pausada</option></SelectField>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
    </>
  );
}

