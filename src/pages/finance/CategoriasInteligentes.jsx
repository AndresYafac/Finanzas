import React from 'react';
import { Check, Plus } from 'lucide-react';
import { Button, Field, Modal, RowActions, SelectField, TableSection } from '../../components/ui';
import { confirmAction, notify } from '../../services/feedback';
import { listMovimientosViewData } from '../../services/movimientos.service';
import { createCategoryRule, deleteCategoryRule, listCategoryRules, updateCategoryRule } from '../../services/smartCategories.service';

const emptyForm = { keyword: '', tipo: 'egreso', categoria: '', tipo_movimiento_id: '', activo: true };

export function CategoriasInteligentes({ supabase, user, can = () => true }) {
  const [rules, setRules] = React.useState([]);
  const [tipos, setTipos] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);

  const load = React.useCallback(async () => {
    const [rulesResult, viewResult] = await Promise.all([
      listCategoryRules(supabase, user.id),
      listMovimientosViewData(supabase, user.id),
    ]);
    setRules(rulesResult.data || []);
    setTipos(viewResult[1].data || []);
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
      keyword: row.keyword || '',
      tipo: row.tipo || 'egreso',
      categoria: row.categoria || '',
      tipo_movimiento_id: row.tipo_movimiento_id || '',
      activo: row.activo !== false,
    });
    setOpen(true);
  }

  async function save(event) {
    event.preventDefault();
    const selectedType = tipos.find((tipo) => tipo.id === form.tipo_movimiento_id);
    const payload = {
      ...form,
      categoria: selectedType?.nombre || form.categoria,
      tipo_movimiento_id: form.tipo_movimiento_id || null,
    };
    const { error } = editingId
      ? await updateCategoryRule(supabase, editingId, payload)
      : await createCategoryRule(supabase, user.id, payload);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify(editingId ? 'Regla actualizada.' : 'Regla creada.', 'success');
    setOpen(false);
    load();
  }

  async function remove(row) {
    if (!(await confirmAction(`Eliminar regla para "${row.keyword}"?`))) return;
    const { error } = await deleteCategoryRule(supabase, row.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('Regla eliminada.', 'success');
    load();
  }

  const filteredTypes = tipos.filter((tipo) => tipo.tipo === form.tipo);

  return (
    <>
      <TableSection
        title="Categorias inteligentes"
        action={can('create') && <Button variant="primary" onClick={openCreate}><Plus size={16} />Nueva regla</Button>}
        columns={['Palabra clave', 'Tipo', 'Categoria sugerida', 'Estado']}
        rows={rules.map((row) => [
          row.keyword,
          row.tipo || '-',
          row.tipos_movimiento?.nombre || row.categoria || '-',
          row.activo ? 'Activa' : 'Inactiva',
          <RowActions key={row.id} canView={false} canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(row)} onDelete={() => remove(row)} />,
        ])}
      />
      <Modal open={open} title={editingId ? 'Editar regla' : 'Nueva regla'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <Field label="Palabra clave" value={form.keyword} onChange={(value) => setForm({ ...form, keyword: value })} placeholder="Ejemplo: netflix, yape, proveedor" required />
            <SelectField label="Tipo" value={form.tipo} onChange={(value) => setForm({ ...form, tipo: value, tipo_movimiento_id: '' })}>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </SelectField>
            <SelectField label="Categoria sugerida" value={form.tipo_movimiento_id} onChange={(value) => setForm({ ...form, tipo_movimiento_id: value })}>
              <option value="">Seleccionar...</option>
              {filteredTypes.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
            </SelectField>
            <SelectField label="Estado" value={form.activo ? '1' : '0'} onChange={(value) => setForm({ ...form, activo: value === '1' })}>
              <option value="1">Activa</option>
              <option value="0">Inactiva</option>
            </SelectField>
          </div>
          <div className="modal-footer">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary"><Check size={16} />Guardar</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
