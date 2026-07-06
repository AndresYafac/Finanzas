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
  actualizarPagoPrestamoRecibido,
  eliminarPagoPrestamoRecibido,
  listPagosPrestamosRecibidosViewData,
  registrarPagoPrestamoRecibido,
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

export function PagosPrestamosRecibidos({ supabase, user, can = () => true }) {
  const emptyForm = { prestamo_id: '', cuenta_id: '', monto: '', metodo: 'Transferencia', referencia: '', fecha: today(), notas: '' };
  const [pagos, setPagos] = React.useState([]);
  const [prestamos, setPrestamos] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(async () => {
    const [pagosQ, prestamosQ, cuentasQ] = await listPagosPrestamosRecibidosViewData(supabase, user.id);
    setPagos(pagosQ.data || []);
    setPrestamos(prestamosQ.data || []);
    setCuentas(cuentasQ.data || []);
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  const prestamosPendientes = prestamos.filter((p) => editingId || Number(p.saldo_inicial || 0) - Number(p.monto_pagado || 0) > 0);
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      prestamo_id: row.prestamo_id || '',
      cuenta_id: row.cuenta_id || '',
      monto: row.monto ?? '',
      metodo: row.metodo || 'Transferencia',
      referencia: row.referencia || '',
      fecha: row.fecha || today(),
      notas: row.notas || '',
    });
    setOpen(true);
  }
  async function remove(row) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction('Eliminar este pago a acreedor? Se revertirá el saldo de la cuenta y el saldo por pagar.'))) return;
    const { error } = await eliminarPagoPrestamoRecibido(supabase, row.id);
    if (error) return notify(error.message);
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
    const payload = {
      p_prestamo_id: form.prestamo_id,
      p_cuenta_id: form.cuenta_id || null,
      p_monto: Number(form.monto || 0),
      p_metodo: form.metodo,
      p_referencia: form.referencia || null,
      p_fecha: form.fecha,
      p_notas: form.notas || null,
    };
    if (!payload.p_prestamo_id || !payload.p_monto || !payload.p_fecha) return;
    const { error } = editingId
      ? await actualizarPagoPrestamoRecibido(supabase, editingId, payload)
      : await registrarPagoPrestamoRecibido(supabase, payload);
    if (error) return notify(error.message);
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Pagos a acreedores"
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo pago a acreedor</button>}
        columns={['Fecha', 'Acreedor', 'Préstamo por pagar', 'Importe', 'Método', 'Cuenta origen']}
        rows={pagos.map((p) => [dateFmt(p.fecha), p.prestamos_recibidos?.acreedor || '-', p.prestamos_recibidos?.descripcion || '-', money(p.monto), p.metodo, p.cuentas?.banco || '-', <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar pago a acreedor' : 'Nuevo pago a acreedor'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="alert alert-warning">Esta operación descuenta dinero de tu cuenta y reduce el saldo que debes al acreedor.</div>
            <SelectField label="Préstamo por pagar" value={form.prestamo_id} onChange={(v) => setForm({ ...form, prestamo_id: v })}>
              <option value="">Seleccionar préstamo por pagar...</option>
              {prestamosPendientes.map((p) => <option key={p.id} value={p.id}>{p.acreedor} - {p.descripcion} - saldo {money(Number(p.saldo_inicial || 0) - Number(p.monto_pagado || 0))}</option>)}
            </SelectField>
            <SelectField label="Cuenta origen del pago" value={form.cuenta_id} onChange={(v) => setForm({ ...form, cuenta_id: v })}>
              <option value="">Sin cuenta</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo} - {money(c.saldo)}</option>)}
            </SelectField>
            <div className="form-row">
              <Field label="Importe pagado" type="number" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} required />
              <Field label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} required />
            </div>
            <div className="form-row">
              <SelectField label="Método" value={form.metodo} onChange={(v) => setForm({ ...form, metodo: v })}><option>Efectivo</option><option>Transferencia</option><option>Yape</option><option>Plin</option><option>Depósito</option></SelectField>
              <Field label="Referencia" value={form.referencia} onChange={(v) => setForm({ ...form, referencia: v })} />
            </div>
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
    </>
  );
}

