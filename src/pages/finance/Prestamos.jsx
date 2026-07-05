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
import {
  actualizarPrestamoOtorgado,
  eliminarPrestamoOtorgado,
  listPrestamosOtorgadosViewData,
  registrarPrestamoOtorgado,
} from '../../services/prestamos.service';
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

export function Prestamos({ supabase, user, can = () => true }) {
  const emptyForm = { cliente_id: '', descripcion: '', monto_total: '', interes: '0', cuenta_desembolso_id: '', fecha_inicio: today(), fecha_vencimiento: '', notas: '' };
  const [prestamos, setPrestamos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(async () => {
    const [prestamosQ, clientesQ, cuentasQ] = await listPrestamosOtorgadosViewData(supabase, user.id);
    setPrestamos((prestamosQ.data || []).map((p) => ({ ...p, estado: calcEstado(p) })));
    setClientes(clientesQ.data || []);
    setCuentas(cuentasQ.data || []);
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(prestamo) {
    setEditingId(prestamo.id);
    setForm({
      cliente_id: prestamo.cliente_id || '',
      descripcion: prestamo.descripcion || '',
      monto_total: prestamo.monto_total ?? '',
      interes: prestamo.interes ?? '0',
      cuenta_desembolso_id: prestamo.cuenta_desembolso_id || '',
      fecha_inicio: prestamo.fecha_inicio || today(),
      fecha_vencimiento: prestamo.fecha_vencimiento || '',
      notas: prestamo.notas || '',
    });
    setOpen(true);
  }
  async function remove(prestamo) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar préstamo ${prestamo.descripcion || ''}? Se revertirá el desembolso.`))) return;
    const { error } = await eliminarPrestamoOtorgado(supabase, prestamo.id);
    if (error) {
      notify(error.message);
      return;
    }
    await logAudit(supabase, user.id, 'prestamos', 'delete', 'Préstamo eliminado', prestamo.id, prestamo);
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
    if (!form.cliente_id || !form.descripcion || !form.monto_total || !form.cuenta_desembolso_id) {
      notify('Cliente, descripción, monto y cuenta origen son obligatorios.');
      return;
    }
    const basePayload = {
      p_cliente_id: form.cliente_id,
      p_descripcion: form.descripcion,
      p_monto_total: Number(form.monto_total || 0),
      p_interes: Number(form.interes || 0),
      p_fecha_inicio: form.fecha_inicio || today(),
      p_fecha_vencimiento: form.fecha_vencimiento || null,
      p_notas: form.notas || null,
      p_cuenta_desembolso_id: form.cuenta_desembolso_id,
    };
    const { error } = editingId
      ? await actualizarPrestamoOtorgado(supabase, editingId, basePayload)
      : await registrarPrestamoOtorgado(supabase, basePayload);
    if (error) {
      notify(error.message);
      return;
    }
    await logAudit(supabase, user.id, 'clientes', editingId ? 'update' : 'insert', editingId ? 'Cliente actualizado' : 'Cliente creado', editingId, form);
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Préstamos otorgados"
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo préstamo</button>}
        columns={['Cliente', 'Descripción', 'Cuenta origen', 'Desembolsado', 'Cobrado', 'Pendiente', 'Estado']}
        rows={prestamos.map((p) => [`${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, p.descripcion, p.cuentas ? `${p.cuentas.banco} - ${p.cuentas.tipo || ''}` : '-', money(p.monto_total), money(p.monto_pagado), money(Number(p.monto_total || 0) - Number(p.monto_pagado || 0)), badge(p.estado), <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar préstamo' : 'Nuevo préstamo'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="alert alert-warning">Esta operación descuenta dinero de la cuenta origen y crea una deuda por cobrar al cliente.</div>
            <SelectField label="Cliente" value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v })}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellido || ''}</option>)}
            </SelectField>
            <SelectField label="Cuenta origen" value={form.cuenta_desembolso_id} onChange={(v) => setForm({ ...form, cuenta_desembolso_id: v })}>
              <option value="">Seleccionar cuenta...</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo} - {money(c.saldo)}</option>)}
            </SelectField>
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} placeholder="Préstamo personal, adelanto..." required />
            <div className="form-row">
              <Field label="Monto desembolsado" type="number" value={form.monto_total} onChange={(v) => setForm({ ...form, monto_total: v })} required />
              <Field label="Interés (%)" type="number" value={form.interes} onChange={(v) => setForm({ ...form, interes: v })} />
            </div>
            <div className="form-row">
              <Field label="Fecha desembolso" type="date" value={form.fecha_inicio} onChange={(v) => setForm({ ...form, fecha_inicio: v })} />
              <Field label="Vencimiento" type="date" value={form.fecha_vencimiento} onChange={(v) => setForm({ ...form, fecha_vencimiento: v })} />
            </div>
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><TrendingDown size={16} />{editingId ? 'Actualizar' : 'Desembolsar'}</button></div>
        </form>
      </Modal>
    </>
  );
}

