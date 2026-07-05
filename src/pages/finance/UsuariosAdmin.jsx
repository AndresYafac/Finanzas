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
  deleteAdminUser,
  listAdminUsers,
  listPermissionsForUser,
  savePermissions as saveUserPermissions,
  updateAdminUser,
  updateAdminUserState,
} from '../../services/admin.service';
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

export function UsuariosAdmin({ supabase, user }) {
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [permissionsOpen, setPermissionsOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [permissionsUser, setPermissionsUser] = React.useState(null);
  const [permissionRows, setPermissionRows] = React.useState({});
  const [form, setForm] = React.useState({ nombre: '', apellido: '', tipo_doc: 'DNI', documento: '', email_contacto: '', telefono: '', direccion: '', empresa: '', moneda: 'PEN', role: 'user' });
  const load = React.useCallback(async () => {
    const { data, error } = await listAdminUsers(supabase);
    if (error) {
      notify(error.message);
      return;
    }
    setRows(data || []);
  }, [supabase]);
  React.useEffect(() => { load(); }, [load]);
  function openEdit(row) {
    if (row.id === user.id) return notify('Edita tu propio usuario desde Mi perfil.');
    setEditingId(row.id);
    setForm({
      nombre: row.nombre || '',
      apellido: row.apellido || '',
      tipo_doc: row.tipo_doc || 'DNI',
      documento: row.documento || '',
      email_contacto: row.email_contacto || '',
      telefono: row.telefono || '',
      direccion: row.direccion || '',
      empresa: row.empresa || '',
      moneda: row.moneda || 'PEN',
      role: row.role || 'user',
    });
    setOpen(true);
  }
  async function save(event) {
    event.preventDefault();
    if (!editingId || editingId === user.id) return notify('No puedes editar tu propio usuario desde este módulo.');
    const { error } = await updateAdminUser(supabase, {
      p_user_id: editingId,
      p_nombre: form.nombre,
      p_apellido: form.apellido,
      p_tipo_doc: form.tipo_doc,
      p_documento: form.documento,
      p_email_contacto: form.email_contacto,
      p_telefono: form.telefono,
      p_direccion: form.direccion,
      p_empresa: form.empresa,
      p_moneda: form.moneda,
      p_role: form.role,
    });
    if (error) return notify(error.message);
    notify('Usuario actualizado correctamente.', 'success');
    setOpen(false);
    setEditingId(null);
    load();
  }
  async function toggle(row) {
    if (row.id === user.id) return notify('No puedes modificar tu propio usuario.');
    const next = !row.activo;
    if (!(await confirmAction(`${next ? 'Activar' : 'Desactivar'} usuario ${row.email_contacto || row.nombre || ''}?`))) return;
    const { error } = await updateAdminUserState(supabase, row.id, next);
    if (error) return notify(error.message);
    notify(next ? 'Usuario activado.' : 'Usuario desactivado.', 'success');
    load();
  }
  async function remove(row) {
    if (row.id === user.id) return notify('No puedes eliminar tu propio usuario.');
    if (!(await confirmAction(`Eliminar usuario ${row.email_contacto || row.nombre || ''}? Esto lo desactivará y ocultará su acceso.`))) return;
    const { error } = await deleteAdminUser(supabase, row.id);
    if (error) return notify(error.message);
    notify('Usuario eliminado lógicamente.', 'success');
    load();
  }
  async function openPermissions(row) {
    if (row.id === user.id) return notify('No necesitas configurar permisos para tu propio usuario.');
    setPermissionsUser(row);
    const defaults = MODULE_PERMISSIONS.reduce((map, [modulo]) => ({
      ...map,
      [modulo]: { modulo, can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false },
    }), {});
    const { data, error } = await listPermissionsForUser(supabase, row.id);
    if (error) {
      notify('Ejecuta primero PERMISOS-AUDITORIA-AVANZADA.sql en Supabase.');
      return;
    }
    setPermissionRows((data || []).reduce((map, item) => ({ ...map, [item.modulo]: { ...defaults[item.modulo], ...item } }), defaults));
    setPermissionsOpen(true);
  }
  function setPerm(moduleId, field, checked) {
    setPermissionRows((current) => ({ ...current, [moduleId]: { ...current[moduleId], [field]: checked } }));
  }
  async function savePermissionRows(event) {
    event.preventDefault();
    if (!permissionsUser) return;
    const payload = Object.values(permissionRows).map((row) => ({
      admin_id: user.id,
      user_id: permissionsUser.id,
      modulo: row.modulo,
      can_view: !!row.can_view,
      can_create: !!row.can_create,
      can_edit: !!row.can_edit,
      can_delete: !!row.can_delete,
      can_export: !!row.can_export,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await saveUserPermissions(supabase, payload);
    if (error) return notify(error.message);
    notify('Permisos actualizados.', 'success');
    setPermissionsOpen(false);
  }
  const filtered = rows.filter((row) => `${row.nombre || ''} ${row.apellido || ''} ${row.email_contacto || ''} ${row.role || ''}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <TableSection
        title="Usuarios"
        search={query}
        setSearch={setQuery}
        columns={['Usuario', 'Contacto', 'Rol', 'Estado', 'Registro']}
        rows={filtered.map((row) => [
          `${row.nombre || '-'} ${row.apellido || ''}`,
          row.email_contacto || row.telefono || '-',
          row.role || 'user',
          row.deleted_at ? <Badge tone="red">Eliminado</Badge> : <Badge tone={row.activo ? 'green' : 'yellow'}>{row.activo ? 'Activo' : 'Inactivo'}</Badge>,
          row.created_at ? new Date(row.created_at).toLocaleDateString('es-PE') : '-',
          row.id === user.id ? <span className="muted">Usuario actual</span> : <div className="row-actions"><button className="btn btn-sm btn-icon" type="button" title="Editar" onClick={() => openEdit(row)}><Pencil size={14} /></button><button className="btn btn-sm" type="button" onClick={() => openPermissions(row)}>Permisos</button><button className="btn btn-sm" type="button" onClick={() => toggle(row)}>{row.activo ? 'Desactivar' : 'Activar'}</button><button className="btn btn-sm btn-danger" type="button" onClick={() => remove(row)}>Eliminar</button></div>,
        ])}
      />
      <Modal open={open} title="Editar usuario" onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="form-row">
              <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
              <Field label="Apellido" value={form.apellido} onChange={(v) => setForm({ ...form, apellido: v })} />
            </div>
            <div className="form-row">
              <SelectField label="Tipo de documento" value={form.tipo_doc} onChange={(v) => setForm({ ...form, tipo_doc: v })}><option>DNI</option><option>RUC</option><option>CE</option><option>Pasaporte</option></SelectField>
              <Field label="Documento" value={form.documento} onChange={(v) => setForm({ ...form, documento: v })} />
            </div>
            <Field label="Email de contacto" type="email" value={form.email_contacto} onChange={(v) => setForm({ ...form, email_contacto: v })} />
            <Field label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
            <Field label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
            <Field label="Empresa / Negocio" value={form.empresa} onChange={(v) => setForm({ ...form, empresa: v })} />
            <div className="form-row">
              <SelectField label="Moneda" value={form.moneda} onChange={(v) => setForm({ ...form, moneda: v })}><option value="PEN">Soles (S/)</option><option value="USD">Dólares ($)</option><option value="EUR">Euros (€)</option></SelectField>
              <SelectField label="Rol" value={form.role} onChange={(v) => setForm({ ...form, role: v })}><option value="user">Usuario</option><option value="admin">Administrador</option></SelectField>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar cambios</button></div>
        </form>
      </Modal>
      <Modal open={permissionsOpen} title={`Permisos de ${permissionsUser?.nombre || 'usuario'}`} onClose={() => setPermissionsOpen(false)} className="permissions-modal">
        <form onSubmit={savePermissionRows}>
          <div className="modal-body permissions-panel">
            <div className="permissions-config-hero">
              <div>
                <strong>Configura accesos por módulo</strong>
                <p>Define qué puede ver y qué acciones puede realizar este usuario.</p>
              </div>
              <span>{Object.values(permissionRows).reduce((sum, row) => sum + PERMISSION_FIELDS.filter(([field]) => row[field]).length, 0)} permisos activos</span>
            </div>
            <div className="permissions-list">
            {MODULE_PERMISSIONS.map(([moduleId, label]) => {
              const row = permissionRows[moduleId] || {};
              const activeCount = PERMISSION_FIELDS.filter(([field]) => row[field]).length;
              return (
                <div className="permission-row-card" key={moduleId}>
                  <div className="permission-module-info">
                    <div>
                      <strong>{label}</strong>
                      <small>{activeCount} permisos activos</small>
                    </div>
                    <Badge tone={row.can_view ? 'green' : 'gray'}>{row.can_view ? 'Visible' : 'Oculto'}</Badge>
                  </div>
                  <div className="permission-toggle-list">
                    {PERMISSION_FIELDS.map(([field, text]) => (
                      <label className={`permission-check ${row[field] ? 'active' : ''}`} key={field}>
                        <input type="checkbox" checked={!!row[field]} onChange={(event) => setPerm(moduleId, field, event.target.checked)} />
                        <span>{text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setPermissionsOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar permisos</button></div>
        </form>
      </Modal>
    </>
  );
}



