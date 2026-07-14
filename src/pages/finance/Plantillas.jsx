import React from 'react';
import { Check, Plus } from 'lucide-react';
import { Button, Field, Modal, RowActions, SelectField, TableSection } from '../../components/ui';
import { confirmAction, notify } from '../../services/feedback';
import { listMovimientosViewData, registrarMovimiento } from '../../services/movimientos.service';
import { createMovementTemplate, deleteMovementTemplate, listMovementTemplates, updateMovementTemplate } from '../../services/templates.service';
import { money, today } from '../../utils/format';

const emptyForm = { nombre: '', tipo: 'egreso', concepto: '', tipo_movimiento_id: '', cuenta_id: '', monto: '' };

export function Plantillas({ supabase, user, can = () => true }) {
  const [templates, setTemplates] = React.useState([]);
  const [tipos, setTipos] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);

  const load = React.useCallback(async () => {
    const [templatesResult, viewResult] = await Promise.all([
      listMovementTemplates(supabase, user.id),
      listMovimientosViewData(supabase, user.id),
    ]);
    setTemplates(templatesResult.data || []);
    setTipos(viewResult[1].data || []);
    setCuentas(viewResult[2].data || []);
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
      nombre: row.nombre || '',
      tipo: row.tipo || 'egreso',
      concepto: row.concepto || '',
      tipo_movimiento_id: row.tipo_movimiento_id || '',
      cuenta_id: row.cuenta_id || '',
      monto: row.monto ?? '',
    });
    setOpen(true);
  }

  async function save(event) {
    event.preventDefault();
    const tipoSeleccionado = tipos.find((tipo) => tipo.id === form.tipo_movimiento_id);
    const payload = {
      ...form,
      categoria: tipoSeleccionado?.nombre || '',
      tipo_movimiento_id: form.tipo_movimiento_id || null,
      cuenta_id: form.cuenta_id || null,
      monto: form.monto === '' ? null : Number(form.monto),
    };
    const { error } = editingId
      ? await updateMovementTemplate(supabase, editingId, payload)
      : await createMovementTemplate(supabase, user.id, payload);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(editingId ? 'Plantilla actualizada.' : 'Plantilla creada.', 'success');
    setOpen(false);
    load();
  }

  async function remove(row) {
    if (!(await confirmAction(`Eliminar plantilla ${row.nombre}?`))) return;
    const { error } = await deleteMovementTemplate(supabase, row.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('Plantilla eliminada.', 'success');
    load();
  }

  async function useTemplate(row) {
    const { error } = await registrarMovimiento(supabase, {
      p_tipo: row.tipo,
      p_concepto: row.concepto || row.nombre,
      p_categoria: row.categoria || row.tipos_movimiento?.nombre || '',
      p_tipo_movimiento_id: row.tipo_movimiento_id || null,
      p_cuenta_id: row.cuenta_id || null,
      p_monto: Number(row.monto || 0),
      p_fecha: today(),
    });
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('Movimiento creado desde plantilla.', 'success');
  }

  const filteredTypes = tipos.filter((tipo) => tipo.tipo === form.tipo);

  return (
    <>
      <TableSection
        title="Plantillas de movimientos"
        action={can('create') && <Button variant="primary" onClick={openCreate}><Plus size={16} />Nueva plantilla</Button>}
        columns={['Nombre', 'Tipo', 'Concepto', 'Categoria', 'Cuenta', 'Monto']}
        rows={templates.map((row) => [
          row.nombre,
          row.tipo,
          row.concepto || '-',
          row.tipos_movimiento?.nombre || row.categoria || '-',
          row.cuentas ? `${row.cuentas.banco} - ${row.cuentas.tipo || ''}` : '-',
          row.monto ? money(row.monto) : '-',
          <div className="row-actions" key={row.id}>
            <Button size="sm" onClick={() => useTemplate(row)}>Usar</Button>
            <RowActions canView={false} canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(row)} onDelete={() => remove(row)} />
          </div>,
        ])}
      />
      <Modal open={open} title={editingId ? 'Editar plantilla' : 'Nueva plantilla'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <Field label="Nombre" value={form.nombre} onChange={(value) => setForm({ ...form, nombre: value })} required />
            <SelectField label="Tipo" value={form.tipo} onChange={(value) => setForm({ ...form, tipo: value, tipo_movimiento_id: '' })}>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </SelectField>
            <Field label="Concepto" value={form.concepto} onChange={(value) => setForm({ ...form, concepto: value })} />
            <SelectField label="Categoria" value={form.tipo_movimiento_id} onChange={(value) => setForm({ ...form, tipo_movimiento_id: value })}>
              <option value="">Seleccionar...</option>
              {filteredTypes.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
            </SelectField>
            <SelectField label="Cuenta" value={form.cuenta_id} onChange={(value) => setForm({ ...form, cuenta_id: value })}>
              <option value="">Sin cuenta</option>
              {cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.banco} - {cuenta.tipo}</option>)}
            </SelectField>
            <Field label="Monto sugerido" type="number" value={form.monto} onChange={(value) => setForm({ ...form, monto: value })} />
          </div>
          <div className="modal-footer">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit"><Check size={16} />Guardar</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
