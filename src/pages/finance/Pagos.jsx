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
import { actualizarPago, eliminarPago, listPagoFormData, listPagosGenerales, registrarPago } from '../../services/pagos.service';
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

export function Pagos({ supabase, user, isAdmin, can = () => true }) {
  const [pagos, setPagos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [deudas, setDeudas] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({ cliente_id: '', deuda_id: '', cuenta_id: '', monto: '', metodo: 'Efectivo', referencia: '', fecha: today(), notas: '' });
  const load = React.useCallback(() => {
    listPagosGenerales(supabase, user.id).then(({ data }) => setPagos(data || []));
  }, [supabase, user.id]);
  React.useEffect(() => {
    load();
    listPagoFormData(supabase, user.id).then(([clientesData, deudasData, cuentasData]) => {
      setClientes(clientesData.data || []);
      setDeudas((deudasData.data || []).map((d) => ({ ...d, estado: calcEstado(d) })));
      setCuentas(cuentasData.data || []);
    });
  }, [load, supabase, user.id]);
  const deudasCliente = deudas.filter((d) => d.cliente_id === form.cliente_id && (editingId || calcEstado(d) !== 'pagado'));
  function openCreate() {
    setEditingId(null);
    setForm({ cliente_id: '', deuda_id: '', cuenta_id: '', monto: '', metodo: 'Efectivo', referencia: '', fecha: today(), notas: '' });
    setOpen(true);
  }
  function openEdit(pago) {
    setEditingId(pago.id);
    setForm({
      cliente_id: pago.cliente_id || '',
      deuda_id: pago.deuda_id || '',
      cuenta_id: pago.cuenta_id || '',
      monto: pago.monto ?? '',
      metodo: pago.metodo || 'Efectivo',
      referencia: pago.referencia || '',
      fecha: pago.fecha || today(),
      notas: pago.notas || '',
    });
    setOpen(true);
  }
  async function remove(pago) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction('Eliminar este cobro? Se revertirá el saldo de la cuenta y la cuenta por cobrar.'))) return;
    const { error } = await eliminarPago(supabase, pago.id);
    if (error) {
      notify(error.message);
      return;
    }
    refreshRelated();
  }
  function refreshRelated() {
    load();
    listPagoFormData(supabase, user.id).then(([, deudasData, cuentasData]) => {
      setDeudas((deudasData.data || []).map((d) => ({ ...d, estado: calcEstado(d) })));
      setCuentas(cuentasData.data || []);
    });
  }
  async function save(event) {
    event.preventDefault();
    const payload = {
      p_deuda_id: form.deuda_id,
      p_cliente_id: form.cliente_id,
      p_cuenta_id: form.cuenta_id || null,
      p_monto: Number(form.monto || 0),
      p_metodo: form.metodo,
      p_referencia: form.referencia || null,
      p_fecha: form.fecha,
      p_notas: form.notas || null,
    };
    if (!payload.p_cliente_id || !payload.p_deuda_id || !payload.p_monto || !payload.p_fecha) return;
    const { error } = editingId
      ? await actualizarPago(supabase, editingId, payload)
      : await registrarPago(supabase, payload);
    if (error) {
      notify(error.message);
      return;
    }
    setForm({ cliente_id: '', deuda_id: '', cuenta_id: '', monto: '', metodo: 'Efectivo', referencia: '', fecha: today(), notas: '' });
    setEditingId(null);
    setOpen(false);
    refreshRelated();
  }
  return (
    <>
      <TableSection
        title="Cobros recibidos"
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo cobro</button>}
        columns={['Fecha', 'Cliente', 'Cuenta cobrada', 'Importe', 'Método', 'Cuenta destino']}
        rows={pagos.map((p) => [dateFmt(p.fecha), `${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, p.deudas?.descripcion || '-', money(p.monto), p.metodo, p.cuentas?.banco || '-', <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar cobro' : 'Registrar cobro'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <SelectField label="Cliente" value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v, deuda_id: '' })}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellido || ''}</option>)}
            </SelectField>
            <SelectField label="Cuenta por cobrar" value={form.deuda_id} onChange={(v) => setForm({ ...form, deuda_id: v })}>
              <option value="">Seleccionar cuenta por cobrar...</option>
              {deudasCliente.map((d) => <option key={d.id} value={d.id}>{d.tipo} - {d.descripcion} - saldo {money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0))}</option>)}
            </SelectField>
            <div className="form-row">
              <Field label="Importe cobrado" type="number" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} required />
              <Field label="Fecha de cobro" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} required />
            </div>
            <div className="form-row">
              <SelectField label="Método" value={form.metodo} onChange={(v) => setForm({ ...form, metodo: v })}><option>Efectivo</option><option>Transferencia</option><option>Yape</option><option>Plin</option><option>Depósito</option></SelectField>
              <SelectField label="Cuenta destino" value={form.cuenta_id} onChange={(v) => setForm({ ...form, cuenta_id: v })}><option value="">Sin cuenta</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo}</option>)}</SelectField>
            </div>
            <Field label="Referencia" value={form.referencia} onChange={(v) => setForm({ ...form, referencia: v })} />
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />{editingId ? 'Actualizar cobro' : 'Registrar cobro'}</button></div>
        </form>
      </Modal>
    </>
  );
}

