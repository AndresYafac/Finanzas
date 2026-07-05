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
  actualizarPrestamoRecibido,
  eliminarPrestamoRecibido,
  listPrestamosRecibidosViewData,
  registrarPrestamoRecibido,
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

export function PrestamosRecibidos({ supabase, user, can = () => true }) {
  const emptyForm = { acreedor: '', descripcion: '', monto_original: '', saldo_inicial: '', interes: '0', es_antiguo: true, cuenta_ingreso_id: '', fecha_inicio: today(), fecha_vencimiento: '', notas: '' };
  const [rows, setRows] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(async () => {
    const [prestamosQ, cuentasQ] = await listPrestamosRecibidosViewData(supabase, user.id);
    setRows(prestamosQ.data || []);
    setCuentas(cuentasQ.data || []);
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function estado(row) {
    const pendiente = Number(row.saldo_inicial || 0) - Number(row.monto_pagado || 0);
    if (pendiente <= 0) return 'pagado';
    if (!row.fecha_vencimiento) return 'al_dia';
    const diff = (new Date(`${row.fecha_vencimiento}T00:00:00`) - new Date(new Date().toDateString())) / 86400000;
    if (diff < 0) return 'vencido';
    if (diff <= 7) return 'por_vencer';
    return 'al_dia';
  }
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      acreedor: row.acreedor || '',
      descripcion: row.descripcion || '',
      monto_original: row.monto_original ?? '',
      saldo_inicial: row.saldo_inicial ?? '',
      interes: row.interes ?? '0',
      es_antiguo: Boolean(row.es_antiguo),
      cuenta_ingreso_id: row.cuenta_ingreso_id || '',
      fecha_inicio: row.fecha_inicio || today(),
      fecha_vencimiento: row.fecha_vencimiento || '',
      notas: row.notas || '',
    });
    setOpen(true);
  }
  async function remove(row) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar préstamo recibido de ${row.acreedor || ''}?`))) return;
    const { error } = await eliminarPrestamoRecibido(supabase, row.id);
    if (error) return notify(error.message);
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
    const saldo = form.saldo_inicial === '' ? form.monto_original : form.saldo_inicial;
    const payload = {
      p_acreedor: form.acreedor,
      p_descripcion: form.descripcion,
      p_monto_original: Number(form.monto_original || 0),
      p_saldo_inicial: Number(saldo || 0),
      p_interes: Number(form.interes || 0),
      p_es_antiguo: Boolean(form.es_antiguo),
      p_cuenta_ingreso_id: form.es_antiguo ? null : form.cuenta_ingreso_id || null,
      p_fecha_inicio: form.fecha_inicio || today(),
      p_fecha_vencimiento: form.fecha_vencimiento || null,
      p_notas: form.notas || null,
    };
    if (!payload.p_acreedor || !payload.p_descripcion || !payload.p_monto_original) return;
    if (!payload.p_es_antiguo && !payload.p_cuenta_ingreso_id) return notify('Selecciona la cuenta donde recibiste el dinero.');
    const { error } = editingId
      ? await actualizarPrestamoRecibido(supabase, editingId, payload)
      : await registrarPrestamoRecibido(supabase, payload);
    if (error) return notify(error.message);
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Préstamos recibidos"
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo préstamo recibido</button>}
        columns={['Acreedor', 'Descripción', 'Tipo', 'Monto original', 'Pagado', 'Pendiente', 'Vencimiento', 'Estado']}
        rows={rows.map((row) => {
          const pendiente = Number(row.saldo_inicial || 0) - Number(row.monto_pagado || 0);
          return [row.acreedor, row.descripcion, row.es_antiguo ? 'Antiguo sin saldo' : `Ingreso a ${row.cuentas?.banco || '-'}`, money(row.monto_original), money(row.monto_pagado), money(pendiente), dateFmt(row.fecha_vencimiento), badge(estado(row)), <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(row)} onDelete={() => remove(row)} />];
        })}
      />
      <Modal open={open} title={editingId ? 'Editar préstamo recibido' : 'Nuevo préstamo recibido'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="alert alert-warning">Para préstamos antiguos que ya gastaste, marca “antiguo” y registra solo el saldo pendiente. No se moverá ninguna cuenta.</div>
            <label className="check-row">
              <input type="checkbox" checked={form.es_antiguo} onChange={(event) => setForm({ ...form, es_antiguo: event.target.checked, cuenta_ingreso_id: '' })} />
              <span>Préstamo antiguo sin mover saldo actual</span>
            </label>
            <Field label="Acreedor" value={form.acreedor} onChange={(v) => setForm({ ...form, acreedor: v })} placeholder="Banco, familiar, proveedor..." required />
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} required />
            {!form.es_antiguo && (
              <SelectField label="Cuenta donde recibiste el dinero" value={form.cuenta_ingreso_id} onChange={(v) => setForm({ ...form, cuenta_ingreso_id: v })}>
                <option value="">Seleccionar cuenta...</option>
                {cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo} - {money(c.saldo)}</option>)}
              </SelectField>
            )}
            <div className="form-row">
              <Field label="Monto original" type="number" value={form.monto_original} onChange={(v) => setForm({ ...form, monto_original: v, saldo_inicial: form.saldo_inicial || v })} required />
              <Field label="Saldo pendiente inicial" type="number" value={form.saldo_inicial} onChange={(v) => setForm({ ...form, saldo_inicial: v })} required />
            </div>
            <div className="form-row">
              <Field label="Interés (%)" type="number" value={form.interes} onChange={(v) => setForm({ ...form, interes: v })} />
              <Field label="Fecha préstamo" type="date" value={form.fecha_inicio} onChange={(v) => setForm({ ...form, fecha_inicio: v })} />
            </div>
            <Field label="Vencimiento" type="date" value={form.fecha_vencimiento} onChange={(v) => setForm({ ...form, fecha_vencimiento: v })} />
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
    </>
  );
}

