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
import { createCuenta, deleteCuenta, getCuentasViewData, registrarTransferencia, updateCuenta } from '../../services/cuentas.service';
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

export function Cuentas({ supabase, user, can = () => true }) {
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferencias, setTransferencias] = React.useState([]);
  const [historial, setHistorial] = React.useState([]);
  const emptyForm = { banco: '', tipo: 'Ahorros', numero: '', cci: '', moneda: 'PEN', saldo: '' };
  const emptyTransfer = { tipo_destino: 'propia', cuenta_origen_id: '', cuenta_destino_id: '', banco_destino: '', numero_destino: '', titular_destino: '', monto: '', fecha: today(), notas: '' };
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [transferForm, setTransferForm] = React.useState(emptyTransfer);
  const load = React.useCallback(async () => {
    const { cuentas: cuentasData, transferencias: transferenciasData, movimientos: movimientosData, pagos: pagosData } = await getCuentasViewData(supabase, user.id);
    setCuentas(cuentasData);
    setTransferencias(transferenciasData);
    setHistorial([
      ...movimientosData.filter((m) => m.cuenta_id).map((m) => ({ fecha: m.fecha, cuenta_id: m.cuenta_id, tipo: m.tipo, detalle: m.concepto, monto: Number(m.monto || 0) })),
      ...pagosData.filter((p) => p.cuenta_id).map((p) => ({ fecha: p.fecha, cuenta_id: p.cuenta_id, tipo: 'ingreso', detalle: `Pago ${p.metodo || ''} - ${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, monto: Number(p.monto || 0) })),
      ...transferenciasData.flatMap((t) => [
        { fecha: t.fecha, cuenta_id: t.cuenta_origen_id, tipo: 'egreso', detalle: 'Transferencia enviada', monto: Number(t.monto || 0) },
        t.cuenta_destino_id ? { fecha: t.fecha, cuenta_id: t.cuenta_destino_id, tipo: 'ingreso', detalle: 'Transferencia recibida', monto: Number(t.monto || 0) } : null,
      ].filter(Boolean)),
    ].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).slice(0, 80));
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(cuenta) {
    setEditingId(cuenta.id);
    setForm({
      banco: cuenta.banco || '',
      tipo: cuenta.tipo || 'Ahorros',
      numero: cuenta.numero || '',
      cci: cuenta.cci || '',
      moneda: cuenta.moneda || 'PEN',
      saldo: cuenta.saldo ?? '',
    });
    setOpen(true);
  }
  async function remove(cuenta) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar cuenta ${cuenta.banco || ''}?`))) return;
    const { error } = await deleteCuenta(supabase, user.id, cuenta.id);
    if (error) {
      notify(error.message);
      return;
    }
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
    const payload = { ...form, saldo: Number(form.saldo || 0) };
    const { error } = editingId
      ? await updateCuenta(supabase, user.id, editingId, payload)
      : await createCuenta(supabase, user.id, payload);
    if (error) {
      notify(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  async function saveTransfer(event) {
    event.preventDefault();
    if (!can('create')) return notify('No tienes permiso para crear transferencias.');
    const payload = {
      p_cuenta_origen_id: transferForm.cuenta_origen_id,
      p_cuenta_destino_id: transferForm.tipo_destino === 'propia' ? transferForm.cuenta_destino_id : null,
      p_tipo_destino: transferForm.tipo_destino,
      p_banco_destino: transferForm.tipo_destino === 'externa' ? transferForm.banco_destino || null : null,
      p_numero_destino: transferForm.tipo_destino === 'externa' ? transferForm.numero_destino || null : null,
      p_titular_destino: transferForm.tipo_destino === 'externa' ? transferForm.titular_destino || null : null,
      p_monto: Number(transferForm.monto || 0),
      p_fecha: transferForm.fecha,
      p_notas: transferForm.notas || null,
    };
    if (!payload.p_cuenta_origen_id || !payload.p_monto || !payload.p_fecha) return;
    if (transferForm.tipo_destino === 'propia' && !payload.p_cuenta_destino_id) return;
    const { error } = await registrarTransferencia(supabase, payload);
    if (error) {
      notify(error.message);
      return;
    }
    setTransferForm(emptyTransfer);
    setTransferOpen(false);
    load();
  }
  const cuentaNombre = (id) => {
    const cuenta = cuentas.find((c) => c.id === id);
    return cuenta ? `${cuenta.banco} - ${cuenta.tipo || ''}` : '-';
  };
  return (
    <>
      <div className="action-bar"><div></div><div className="table-actions">{can('create') && <button className="btn" onClick={() => setTransferOpen(true)}><ArrowRightLeft size={16} />Nueva transferencia</button>}{can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva cuenta</button>}</div></div>
      <div className="grid-3">{cuentas.map((c) => <div className="account-card account-card-hover" key={c.id}><div className="account-card-actions"><RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(c)} onDelete={() => remove(c)} /></div><Building2 /><strong>{c.banco}</strong><span>{c.tipo} - {c.moneda}</span><b>{money(c.saldo)}</b></div>)}</div>
      <div className="card transfer-card"><div className="card-header"><h3>Ultimas transferencias</h3></div><div className="card-body">{transferencias.length ? transferencias.map((t) => <div className="list-row transfer-row" key={t.id}><span>{dateFmt(t.fecha)} - {cuentaNombre(t.cuenta_origen_id)} a {t.tipo_destino === 'propia' ? cuentaNombre(t.cuenta_destino_id) : `${t.banco_destino || 'Cuenta externa'} ${t.numero_destino || ''}`}</span><strong>{money(t.monto)}</strong></div>) : <div className="empty-state"><p>Sin transferencias registradas</p></div>}</div></div>
      <div className="report-spacer" />
      <TableSection title="Historial por cuenta" columns={['Fecha', 'Cuenta', 'Tipo', 'Detalle', 'Monto']} rows={historial.map((h) => [dateFmt(h.fecha), cuentaNombre(h.cuenta_id), badge(h.tipo), h.detalle || '-', money(h.monto)])} />
      <Modal open={open} title={editingId ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <Field label="Banco" value={form.banco} onChange={(v) => setForm({ ...form, banco: v })} required />
            <div className="form-row">
              <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })}><option>Ahorros</option><option>Corriente</option><option>Billetera</option></SelectField>
              <SelectField label="Moneda" value={form.moneda} onChange={(v) => setForm({ ...form, moneda: v })}><option value="PEN">Soles</option><option value="USD">Dólares</option><option value="EUR">Euros</option></SelectField>
            </div>
            <Field label="Número" value={form.numero} onChange={(v) => setForm({ ...form, numero: v })} />
            <Field label="CCI" value={form.cci} onChange={(v) => setForm({ ...form, cci: v })} />
            <Field label="Saldo inicial" type="number" value={form.saldo} onChange={(v) => setForm({ ...form, saldo: v })} />
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
      <TransferenciaModal open={transferOpen} onClose={() => setTransferOpen(false)} onSubmit={saveTransfer} form={transferForm} setForm={setTransferForm} cuentas={cuentas} />
    </>
  );
}

function TransferenciaModal({ open, onClose, onSubmit, form, setForm, cuentas }) {
  return (
    <Modal open={open} title="Nueva transferencia" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          <SelectField label="Cuenta origen" value={form.cuenta_origen_id} onChange={(v) => setForm({ ...form, cuenta_origen_id: v })}>
            <option value="">Seleccionar cuenta...</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo} - {money(c.saldo)}</option>)}
          </SelectField>
          <SelectField label="Destino" value={form.tipo_destino} onChange={(v) => setForm({ ...form, tipo_destino: v, cuenta_destino_id: '' })}>
            <option value="propia">Entre mis cuentas</option>
            <option value="externa">Otra cuenta bancaria</option>
          </SelectField>
          {form.tipo_destino === 'propia' ? (
            <SelectField label="Cuenta destino" value={form.cuenta_destino_id} onChange={(v) => setForm({ ...form, cuenta_destino_id: v })}>
              <option value="">Seleccionar cuenta...</option>
              {cuentas.filter((c) => c.id !== form.cuenta_origen_id).map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo}</option>)}
            </SelectField>
          ) : (
            <>
              <Field label="Banco destino" value={form.banco_destino} onChange={(v) => setForm({ ...form, banco_destino: v })} required />
              <Field label="Numero de cuenta / CCI" value={form.numero_destino} onChange={(v) => setForm({ ...form, numero_destino: v })} required />
              <Field label="Titular destino" value={form.titular_destino} onChange={(v) => setForm({ ...form, titular_destino: v })} />
            </>
          )}
          <div className="form-row">
            <Field label="Monto" type="number" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} required />
            <Field label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} required />
          </div>
          <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        </div>
        <div className="modal-footer"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary"><ArrowRightLeft size={16} />Transferir</button></div>
      </form>
    </Modal>
  );
}

