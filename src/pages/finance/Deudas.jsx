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
import { createDeuda, deleteDeuda, listDeudasViewData, updateDeuda } from '../../services/deudas.service';
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

export function Deudas({ supabase, user, isAdmin, can = () => true }) {
  const [deudas, setDeudas] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const emptyDebtForm = { cliente_id: '', descripcion: '', monto_total: '', interes: '0', tipo: 'Venta', fecha_inicio: today(), fecha_vencimiento: '', notas: '' };
  const [form, setForm] = React.useState(emptyDebtForm);
  const load = React.useCallback(() => {
    listDeudasViewData(supabase, user.id).then(([deudasData, clientesData]) => {
      setDeudas((deudasData.data || []).filter((d) => d.tipo !== 'Préstamo').map((d) => ({ ...d, estado: calcEstado(d) })));
      setClientes(clientesData.data || []);
    });
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyDebtForm);
    setOpen(true);
  }
  function openEdit(deuda) {
    setEditingId(deuda.id);
    setForm({
      cliente_id: deuda.cliente_id || '',
      descripcion: deuda.descripcion || '',
      monto_total: deuda.monto_total ?? '',
      interes: deuda.interes ?? '0',
      tipo: deuda.tipo || 'Préstamo',
      fecha_inicio: deuda.fecha_inicio || today(),
      fecha_vencimiento: deuda.fecha_vencimiento || '',
      notas: deuda.notas || '',
    });
    setOpen(true);
  }
  async function remove(deuda) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar deuda ${deuda.descripcion || ''}?`))) return;
    const { error } = await deleteDeuda(supabase, user.id, deuda.id);
    if (error) {
      notify(error.message);
      return;
    }
    load();
  }
  async function save(event) {
    event.preventDefault();
    const payload = {
      admin_id: user.id,
      cliente_id: form.cliente_id,
      descripcion: form.descripcion,
      monto_total: Number(form.monto_total || 0),
      interes: Number(form.interes || 0),
      tipo: form.tipo,
      fecha_inicio: form.fecha_inicio || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      notas: form.notas,
    };
    if (!payload.cliente_id || !payload.descripcion || !payload.monto_total) return;
    const { error } = editingId
      ? await updateDeuda(supabase, user.id, editingId, payload)
      : await createDeuda(supabase, payload);
    if (error) {
      notify(error.message);
      return;
    }
    setForm(emptyDebtForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Pendientes por cobrar"
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva deuda</button>}
        columns={['Cliente', 'Descripción', 'Tipo', 'Total', 'Pendiente', 'Vencimiento', 'Estado']}
        rows={deudas.map((d) => [`${d.clientes?.nombre || ''} ${d.clientes?.apellido || ''}`, d.descripcion, d.tipo, money(d.monto_total), money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0)), dateFmt(d.fecha_vencimiento), badge(d.estado), <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(d)} onDelete={() => remove(d)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar deuda' : 'Nueva deuda'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <SelectField label="Cliente" value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v })}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellido || ''}</option>)}
            </SelectField>
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} required />
            <div className="form-row">
              <Field label="Monto total" type="number" value={form.monto_total} onChange={(v) => setForm({ ...form, monto_total: v })} required />
              <Field label="Interés (%)" type="number" value={form.interes} onChange={(v) => setForm({ ...form, interes: v })} />
            </div>
            <div className="form-row">
              <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })}><option>Venta</option><option>Servicio</option><option>Otro</option></SelectField>
              <Field label="Vencimiento" type="date" value={form.fecha_vencimiento} onChange={(v) => setForm({ ...form, fecha_vencimiento: v })} />
            </div>
            <Field label="Fecha inicio" type="date" value={form.fecha_inicio} onChange={(v) => setForm({ ...form, fecha_inicio: v })} />
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
    </>
  );
}

