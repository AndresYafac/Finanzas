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
  actualizarPrestamoPorCobrar,
  createDeuda,
  deleteDeuda,
  eliminarPrestamoPorCobrar,
  listDeudasViewData,
  registrarDeudaConDesembolso,
  updateDeuda,
} from '../../services/deudas.service';
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
  const [cuentas, setCuentas] = React.useState([]);
  const [tipoFilter, setTipoFilter] = React.useState('todos');
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [editingType, setEditingType] = React.useState('');
  const emptyDebtForm = { cliente_id: '', descripcion: '', monto_total: '', interes: '0', tipo: 'Venta', cuenta_desembolso_id: '', fecha_inicio: today(), fecha_vencimiento: '', notas: '' };
  const [form, setForm] = React.useState(emptyDebtForm);
  const load = React.useCallback(() => {
    listDeudasViewData(supabase, user.id).then(([deudasData, clientesData, cuentasData]) => {
      setDeudas((deudasData.data || []).map((d) => ({ ...d, estado: calcEstado(d) })));
      setClientes(clientesData.data || []);
      setCuentas(cuentasData.data || []);
    });
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setEditingType('');
    setForm(emptyDebtForm);
    setOpen(true);
  }
  function openEdit(deuda) {
    setEditingId(deuda.id);
    setEditingType(deuda.tipo || '');
    setForm({
      cliente_id: deuda.cliente_id || '',
      descripcion: deuda.descripcion || '',
      monto_total: deuda.monto_total ?? '',
      interes: deuda.interes ?? '0',
      tipo: deuda.tipo || 'Venta',
      cuenta_desembolso_id: deuda.cuenta_desembolso_id || '',
      fecha_inicio: deuda.fecha_inicio || today(),
      fecha_vencimiento: deuda.fecha_vencimiento || '',
      notas: deuda.notas || '',
    });
    setOpen(true);
  }
  async function remove(deuda) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    const isLoan = deuda.tipo === 'Préstamo';
    const question = isLoan
      ? `Eliminar préstamo por cobrar ${deuda.descripcion || ''}? Se revertirá el desembolso.`
      : `Eliminar cuenta por cobrar ${deuda.descripcion || ''}?`;
    if (!(await confirmAction(question))) return;
    const { error } = isLoan
      ? await eliminarPrestamoPorCobrar(supabase, deuda.id)
      : await deleteDeuda(supabase, user.id, deuda.id);
    if (error) {
      notify(error.message);
      return;
    }
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && editingType && editingType !== form.tipo) {
      notify('No se puede cambiar el tipo de una cuenta por cobrar ya registrada. Crea un nuevo registro si necesitas otro tipo.');
      return;
    }
    const isLoan = form.tipo === 'Préstamo';
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
    if (isLoan && !form.cuenta_desembolso_id) {
      notify('Selecciona la cuenta origen del desembolso.');
      return;
    }
    const loanUpdatePayload = {
      p_cliente_id: form.cliente_id,
      p_descripcion: form.descripcion,
      p_monto_total: Number(form.monto_total || 0),
      p_interes: Number(form.interes || 0),
      p_fecha_inicio: form.fecha_inicio || today(),
      p_fecha_vencimiento: form.fecha_vencimiento || null,
      p_notas: form.notas || null,
      p_cuenta_desembolso_id: form.cuenta_desembolso_id,
    };
    const loanCreatePayload = {
      ...loanUpdatePayload,
      p_tipo: 'Préstamo',
      p_desembolsar: true,
    };
    const { error } = isLoan
      ? (editingId
        ? await actualizarPrestamoPorCobrar(supabase, editingId, loanUpdatePayload)
        : await registrarDeudaConDesembolso(supabase, loanCreatePayload))
      : (editingId
        ? await updateDeuda(supabase, user.id, editingId, payload)
        : await createDeuda(supabase, payload));
    if (error) {
      notify(error.message);
      return;
    }
    setForm(emptyDebtForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  const visibleDeudas = tipoFilter === 'todos' ? deudas : deudas.filter((d) => d.tipo === tipoFilter);
  const toolbar = (
    <div className="table-toolbar-inline">
      <SelectField label="Filtrar por tipo" value={tipoFilter} onChange={setTipoFilter}>
        <option value="todos">Todos</option>
        <option value="Venta">Ventas</option>
        <option value="Servicio">Servicios</option>
        <option value="Préstamo">Préstamos por cobrar</option>
        <option value="Otro">Otros</option>
      </SelectField>
      {can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva cuenta por cobrar</button>}
    </div>
  );
  return (
    <>
      <TableSection
        title="Cuentas por cobrar"
        action={toolbar}
        columns={['Cliente', 'Concepto', 'Tipo', 'Cuenta origen', 'Importe', 'Cobrado', 'Saldo', 'Vencimiento', 'Estado']}
        rows={visibleDeudas.map((d) => [`${d.clientes?.nombre || ''} ${d.clientes?.apellido || ''}`, d.descripcion, d.tipo, d.tipo === 'Préstamo' ? (d.cuentas ? `${d.cuentas.banco} - ${d.cuentas.tipo || ''}` : '-') : '-', money(d.monto_total), money(d.monto_pagado), money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0)), dateFmt(d.fecha_vencimiento), badge(d.estado), <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(d)} onDelete={() => remove(d)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar cuenta por cobrar' : 'Nueva cuenta por cobrar'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            {form.tipo === 'Préstamo' && <div className="alert alert-warning">El préstamo por cobrar descuenta dinero de la cuenta origen y crea una cuenta por cobrar al cliente.</div>}
            <SelectField label="Cliente" value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v })}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellido || ''}</option>)}
            </SelectField>
            <Field label="Concepto" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} required />
            <div className="form-row">
              <Field label="Importe" type="number" value={form.monto_total} onChange={(v) => setForm({ ...form, monto_total: v })} required />
              <Field label="Interés (%)" type="number" value={form.interes} onChange={(v) => setForm({ ...form, interes: v })} />
            </div>
            <div className="form-row">
              <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })}><option>Venta</option><option>Servicio</option><option>Préstamo</option><option>Otro</option></SelectField>
              <Field label="Vencimiento" type="date" value={form.fecha_vencimiento} onChange={(v) => setForm({ ...form, fecha_vencimiento: v })} />
            </div>
            {form.tipo === 'Préstamo' && (
              <SelectField label="Cuenta origen del desembolso" value={form.cuenta_desembolso_id} onChange={(v) => setForm({ ...form, cuenta_desembolso_id: v })}>
                <option value="">Seleccionar cuenta...</option>
                {cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo} - {money(c.saldo)}</option>)}
              </SelectField>
            )}
            <Field label="Fecha inicio" type="date" value={form.fecha_inicio} onChange={(v) => setForm({ ...form, fecha_inicio: v })} />
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
    </>
  );
}

