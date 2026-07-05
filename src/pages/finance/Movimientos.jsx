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
  actualizarMovimiento,
  actualizarTipoMovimiento,
  crearTipoMovimiento,
  eliminarMovimiento,
  eliminarTipoMovimiento,
  listMovimientosViewData,
  registrarMovimiento,
} from '../../services/movimientos.service';
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

export function Movimientos({ supabase, user, isAdmin, can = () => true }) {
  const [movimientos, setMovimientos] = React.useState([]);
  const [tipos, setTipos] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [tipoForm, setTipoForm] = React.useState({ tipo: 'ingreso', nombre: '' });
  const [tipoEditingId, setTipoEditingId] = React.useState(null);
  const [tiposOpen, setTiposOpen] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({ tipo: 'ingreso', concepto: '', tipo_movimiento_id: '', cuenta_id: '', monto: '', fecha: today() });
  const load = React.useCallback(async () => {
    const [{ data }, { data: tiposData }, { data: cuentasData }] = await listMovimientosViewData(supabase, user.id);
    setMovimientos(data || []);
    setTipos(tiposData || []);
    setCuentas(cuentasData || []);
  }, [supabase, user.id, isAdmin]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm({ tipo: 'ingreso', concepto: '', tipo_movimiento_id: '', cuenta_id: '', monto: '', fecha: today() });
    setOpen(true);
  }
  function openEdit(movimiento) {
    setEditingId(movimiento.id);
    setForm({
      tipo: movimiento.tipo || 'ingreso',
      concepto: movimiento.concepto || '',
      tipo_movimiento_id: movimiento.tipo_movimiento_id || '',
      cuenta_id: movimiento.cuenta_id || '',
      monto: movimiento.monto ?? '',
      fecha: movimiento.fecha || today(),
    });
    setOpen(true);
  }
  async function remove(movimiento) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar movimiento ${movimiento.concepto || ''}?`))) return;
    const { error } = await eliminarMovimiento(supabase, movimiento.id);
    if (error) {
      notify(error.message);
      return;
    }
    load();
  }
  async function save(event) {
    event.preventDefault();
    const tipoSeleccionado = tipos.find((t) => t.id === form.tipo_movimiento_id);
    const payload = {
      p_tipo: form.tipo,
      p_concepto: form.concepto,
      p_categoria: tipoSeleccionado?.nombre || '',
      p_tipo_movimiento_id: form.tipo_movimiento_id || null,
      p_cuenta_id: form.cuenta_id || null,
      p_monto: Number(form.monto || 0),
      p_fecha: form.fecha,
    };
    const { error } = editingId
      ? await actualizarMovimiento(supabase, editingId, payload)
      : await registrarMovimiento(supabase, payload);
    if (error) {
      notify(error.message);
      return;
    }
    setForm({ tipo: 'ingreso', concepto: '', tipo_movimiento_id: '', cuenta_id: '', monto: '', fecha: today() });
    setEditingId(null);
    setOpen(false);
    load();
  }
  async function saveTipo(event) {
    event.preventDefault();
    if (tipoEditingId && !can('edit')) return notify('No tienes permiso para editar tipos.');
    if (!tipoEditingId && !can('create')) return notify('No tienes permiso para crear tipos.');
    if (!tipoForm.nombre) return;
    const { error } = tipoEditingId
      ? await actualizarTipoMovimiento(supabase, user.id, tipoEditingId, tipoForm)
      : await crearTipoMovimiento(supabase, user.id, tipoForm);
    if (error) {
      notify(error.message);
      return;
    }
    setTipoForm({ tipo: 'ingreso', nombre: '' });
    setTipoEditingId(null);
    load();
  }
  function editTipo(tipo) {
    setTipoEditingId(tipo.id);
    setTipoForm({ tipo: tipo.tipo, nombre: tipo.nombre });
  }
  async function removeTipo(tipo) {
    if (!can('delete')) return notify('No tienes permiso para eliminar tipos.');
    if (!(await confirmAction(`Eliminar tipo ${tipo.nombre || ''}?`))) return;
    const { error } = await eliminarTipoMovimiento(supabase, user.id, tipo.id);
    if (error) {
      notify(error.message);
      return;
    }
    if (tipoEditingId === tipo.id) {
      setTipoEditingId(null);
      setTipoForm({ tipo: 'ingreso', nombre: '' });
    }
    load();
  }
  const tiposFiltrados = tipos.filter((t) => t.tipo === form.tipo);
  return (
    <>
      <TableSection
        title="Historial de movimientos"
        action={<div className="table-actions">{(can('create') || can('edit') || can('delete')) && <button className="btn" onClick={() => setTiposOpen(true)}><Settings size={16} />Tipos</button>}{can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo movimiento</button>}</div>}
        columns={['Fecha', 'Tipo', 'Concepto', 'Tipo de movimiento', 'Cuenta', 'Monto']}
        rows={movimientos.map((m) => [dateFmt(m.fecha), badge(m.tipo), m.concepto, m.tipos_movimiento?.nombre || m.categoria || '-', m.cuentas ? `${m.cuentas.banco} - ${m.cuentas.tipo || ''}` : '-', money(m.monto), <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(m)} onDelete={() => remove(m)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v, tipo_movimiento_id: '' })}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></SelectField>
            <SelectField label="Tipo de movimiento" value={form.tipo_movimiento_id} onChange={(v) => setForm({ ...form, tipo_movimiento_id: v })}>
              <option value="">Seleccionar...</option>
              {tiposFiltrados.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </SelectField>
            <SelectField label="Cuenta bancaria" value={form.cuenta_id} onChange={(v) => setForm({ ...form, cuenta_id: v })}>
              <option value="">Seleccionar cuenta...</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo} - {money(c.saldo)}</option>)}
            </SelectField>
            <Field label="Concepto" value={form.concepto} onChange={(v) => setForm({ ...form, concepto: v })} required />
            <div className="form-row">
              <Field label="Monto" type="number" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} required />
              <Field label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} />
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />{editingId ? 'Actualizar' : 'Guardar'}</button></div>
        </form>
      </Modal>
      <Modal open={tiposOpen} title="Mantenimiento de tipos" onClose={() => setTiposOpen(false)}>
        <form onSubmit={saveTipo}>
          <div className="modal-body">
            <div className="form-row">
              <SelectField label="Tipo" value={tipoForm.tipo} onChange={(v) => setTipoForm({ ...tipoForm, tipo: v })}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></SelectField>
              <Field label="Nombre" value={tipoForm.nombre} onChange={(v) => setTipoForm({ ...tipoForm, nombre: v })} placeholder="Pago empresa, Servicios..." required />
            </div>
            <div className="mini-list">
              {tipos.map((t) => <div key={t.id} className="list-row type-row"><span>{badge(t.tipo)} {t.nombre}</span><RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => editTipo(t)} onDelete={() => removeTipo(t)} /></div>)}
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setTiposOpen(false)}>Cerrar</button><button className="btn btn-primary">{tipoEditingId ? <Check size={16} /> : <Plus size={16} />}{tipoEditingId ? 'Actualizar' : 'Agregar'}</button></div>
        </form>
      </Modal>
    </>
  );
}

