import React from 'react';
import {
  ArrowRightLeft,
  Building2,
  Check,
  ClipboardList,
  FileDown,
  Pencil,
  Plus,
  Search,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Badge, Field, Modal, RowActions, SelectField, TableSection } from '../../components/ui';
import { confirmAction, notify } from '../../services/feedback';
import { createCliente, deleteCliente, listClientes, updateCliente } from '../../services/clientes.service';
import { lookupDocument } from '../../services/documentLookup.service';
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

export function Clientes({ supabase, user, can = () => true }) {
  const [clientes, setClientes] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const emptyForm = { nombre: '', apellido: '', tipo_doc: 'DNI', documento: '', telefono: '', email: '', direccion: '', notas: '' };
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const load = React.useCallback(() => listClientes(supabase, user.id).then(({ data }) => setClientes(data || [])), [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(cliente) {
    setEditingId(cliente.id);
    setForm({
      nombre: cliente.nombre || '',
      apellido: cliente.apellido || '',
      tipo_doc: cliente.tipo_doc || 'DNI',
      documento: cliente.documento || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
      notas: cliente.notas || '',
    });
    setOpen(true);
  }
  async function remove(cliente) {
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar cliente ${cliente.nombre || ''} ${cliente.apellido || ''}?`))) return;
    const { error } = await deleteCliente(supabase, user.id, cliente.id);
    if (error) {
      notify(error.message);
      return;
    }
    notify('Cliente eliminado correctamente.', 'success');
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (!form.nombre) return;
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
    const { error } = editingId
      ? await updateCliente(supabase, user.id, editingId, form)
      : await createCliente(supabase, user.id, form);
    if (error) {
      notify(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    notify(editingId ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.', 'success');
    load();
  }
  async function searchDocument() {
    if (!form.documento) return notify('Ingresa un documento para buscar.');
    if (!['DNI', 'RUC'].includes(form.tipo_doc)) return notify('La búsqueda automática está disponible para DNI o RUC.');
    setLookupLoading(true);
    const { data, error } = await lookupDocument({ tipo: form.tipo_doc, documento: form.documento });
    setLookupLoading(false);
    if (error) return notify(error);
    setForm((current) => ({
      ...current,
      nombre: data.nombre || current.nombre,
      apellido: data.apellido || current.apellido,
      direccion: data.direccion || current.direccion,
    }));
    notify('Documento consultado correctamente.', 'success');
  }
  const filtered = clientes.filter((c) => `${c.nombre} ${c.apellido} ${c.email} ${c.documento}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <TableSection
        title="Clientes"
        search={query}
        setSearch={setQuery}
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo cliente</button>}
        columns={['Cliente', 'Documento', 'Teléfono', 'Email', 'Dirección']}
        rows={filtered.map((c) => [`${c.nombre || '-'} ${c.apellido || ''}`, `${c.tipo_doc || 'DNI'} ${c.documento || '-'}`, c.telefono || '-', c.email || '-', c.direccion || '-', <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(c)} onDelete={() => remove(c)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="form-row">
              <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required />
              <Field label="Apellido" value={form.apellido} onChange={(v) => setForm({ ...form, apellido: v })} />
            </div>
            <div className="form-row">
              <SelectField label="Tipo documento" value={form.tipo_doc} onChange={(v) => setForm({ ...form, tipo_doc: v })}><option>DNI</option><option>RUC</option><option>CE</option><option>Pasaporte</option></SelectField>
              <Field
                label="Documento"
                value={form.documento}
                onChange={(v) => setForm({ ...form, documento: v })}
                rightElement={<button className="input-action document-search-btn" type="button" onClick={searchDocument} disabled={lookupLoading} title="Buscar documento">{lookupLoading ? '...' : <Search size={17} />}</button>}
              />
            </div>
            <Field label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />{editingId ? 'Actualizar' : 'Guardar'}</button></div>
        </form>
      </Modal>
    </>
  );
}

