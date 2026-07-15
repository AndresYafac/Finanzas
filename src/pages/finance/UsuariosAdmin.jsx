import React from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserMinus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { confirmAction, notify } from '../../services/feedback';
import {
  deleteAdminUser,
  listAdminUsers,
  listPermissionsForUser,
  savePermissions as saveUserPermissions,
  updateAdminUser,
  updateAdminUserState,
} from '../../services/admin.service';
import { MODULE_PERMISSIONS, PERMISSION_FIELDS } from './financePageShared';

const PERMISSION_GROUPS = [
  { id: 'principal', label: 'Principal', modules: ['dashboard', 'clientes'] },
  { id: 'dinero', label: 'Dinero', modules: ['cuentas', 'movimientos', 'caja-diaria', 'plantillas', 'categorias-inteligentes'] },
  { id: 'cobros', label: 'Cobros', modules: ['deudas', 'pagos'] },
  { id: 'por-pagar', label: 'Por pagar', modules: ['prestamos-recibidos', 'pagos-prestamos-recibidos'] },
  { id: 'planificacion', label: 'Planificacion', modules: ['presupuestos', 'metas', 'cierre-mensual'] },
  { id: 'analisis', label: 'Analisis', modules: ['reportes', 'backup', 'auditoria'] },
];

const PERMISSION_PRESETS = [
  {
    id: 'basic',
    label: 'Basico',
    description: 'Principal + Dinero',
    modules: ['dashboard', 'clientes', 'cuentas', 'movimientos', 'caja-diaria', 'plantillas', 'categorias-inteligentes'],
    mode: 'full',
  },
  {
    id: 'collection',
    label: 'Cobranza',
    description: 'Principal + Cobros',
    modules: ['dashboard', 'clientes', 'deudas', 'pagos'],
    mode: 'full',
  },
  {
    id: 'read',
    label: 'Solo lectura',
    description: 'Ver sin editar',
    modules: MODULE_PERMISSIONS.map(([moduleId]) => moduleId),
    mode: 'read',
  },
  {
    id: 'full',
    label: 'Usuario completo',
    description: 'Todo operativo',
    modules: MODULE_PERMISSIONS.map(([moduleId]) => moduleId),
    mode: 'full',
  },
];

const userColumns = [
  { key: 'name', label: 'Usuario' },
  { key: 'email', label: 'Correo acceso' },
  { key: 'emailConfirmed', label: 'Confirmacion' },
  { key: 'contact', label: 'Contacto' },
  { key: 'role', label: 'Rol' },
  { key: 'status', label: 'Estado' },
  { key: 'created', label: 'Registro' },
];

const toneClasses = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const buttonBase = 'inline-flex items-center justify-center gap-2 rounded-xl border font-black transition focus:outline-none focus:ring-4';
const primaryButton = `${buttonBase} border-emerald-600 bg-emerald-600 px-5 py-3 text-white shadow-glow hover:border-emerald-700 hover:bg-emerald-700 focus:ring-emerald-100`;
const neutralButton = `${buttonBase} border border-slate-200 bg-white px-5 py-3 text-slate-900 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-100`;
const dangerButton = `${buttonBase} border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 hover:bg-red-100 focus:ring-red-100`;

const statCards = [
  { key: 'total', label: 'Total usuarios', icon: Users, tone: 'slate' },
  { key: 'active', label: 'Activos', icon: UserCheck, tone: 'emerald' },
  { key: 'inactive', label: 'Inactivos', icon: UserMinus, tone: 'amber' },
  { key: 'deleted', label: 'Eliminados', icon: UserX, tone: 'red' },
];

const statStyles = {
  slate: {
    card: 'border-slate-300 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.10)]',
    accent: 'bg-slate-900',
    icon: 'bg-slate-900 text-white',
    label: 'text-slate-500',
    value: 'text-slate-950',
    bar: 'bg-slate-900',
  },
  emerald: {
    card: 'border-emerald-200 bg-white shadow-[0_16px_36px_rgba(16,185,129,0.13)]',
    accent: 'bg-emerald-500',
    icon: 'bg-emerald-600 text-white',
    label: 'text-emerald-700',
    value: 'text-emerald-800',
    bar: 'bg-emerald-500',
  },
  amber: {
    card: 'border-amber-200 bg-white shadow-[0_16px_36px_rgba(245,158,11,0.13)]',
    accent: 'bg-amber-500',
    icon: 'bg-amber-500 text-white',
    label: 'text-amber-700',
    value: 'text-amber-800',
    bar: 'bg-amber-500',
  },
  red: {
    card: 'border-red-200 bg-white shadow-[0_16px_36px_rgba(239,68,68,0.12)]',
    accent: 'bg-red-500',
    icon: 'bg-red-500 text-white',
    label: 'text-red-700',
    value: 'text-red-800',
    bar: 'bg-red-500',
  },
};

function makePermissionRow(moduleId, mode = 'none') {
  const enabled = mode === 'full';
  return {
    modulo: moduleId,
    can_view: mode === 'read' || enabled,
    can_create: enabled,
    can_edit: enabled,
    can_delete: enabled,
    can_export: enabled,
  };
}

function applyModulesPermission(current, modules, mode) {
  return modules.reduce((map, moduleId) => ({
    ...map,
    [moduleId]: { ...map[moduleId], ...makePermissionRow(moduleId, mode) },
  }), current);
}

function textValue(value) {
  return String(value || '').toLowerCase();
}

function userName(row) {
  return `${row.nombre || '-'} ${row.apellido || ''}`.trim();
}

function getUserStatus(row) {
  if (row.deleted_at) return { text: 'Eliminado', tone: 'red' };
  if (row.activo) return { text: 'Activo', tone: 'green' };
  return { text: 'Inactivo', tone: 'yellow' };
}

function getEmailConfirmation(row) {
  if (!row.email_auth) return { text: 'Sin correo', tone: 'gray' };
  if (!Object.prototype.hasOwnProperty.call(row, 'email_confirmed_at')) return { text: 'Sin dato', tone: 'gray' };
  if (row.email_confirmed_at) return { text: 'Confirmado', tone: 'green' };
  return { text: 'Pendiente', tone: 'yellow' };
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('es-PE') : '-';
}

function rowToExport(row) {
  const status = getUserStatus(row);
  return {
    name: userName(row),
    email: row.email_auth || row.email_contacto || '-',
    emailConfirmed: getEmailConfirmation(row).text,
    contact: row.email_contacto && row.email_contacto !== row.email_auth ? row.email_contacto : row.telefono || '-',
    role: row.role || 'user',
    status: status.text,
    created: formatDate(row.created_at),
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function StatusBadge({ tone = 'gray', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1 ${toneClasses[tone] || toneClasses.gray}`}>
      {children}
    </span>
  );
}

function TailwindModal({ open, title, onClose, children, size = 'xl' }) {
  if (!open) return null;
  const maxWidth = size === 'wide' ? 'max-w-6xl' : 'max-w-3xl';
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-4">
      <div className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-black text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900">
            <X size={22} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function TextField({ label, type = 'text', value, onChange, className = '', ...props }) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        {...props}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      >
        {children}
      </select>
    </label>
  );
}

function SortButton({ active, direction, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-6 w-6 items-center justify-center rounded-md border-0 bg-transparent transition ${active ? 'text-emerald-700' : 'text-slate-300 hover:text-slate-600'}`}>
      {active && direction === 'desc' ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
    </button>
  );
}

function EmptyUsers() {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
      <Users className="mb-3 text-slate-400" size={36} />
      <strong className="text-slate-900">Sin usuarios para mostrar</strong>
      <p className="mt-1 text-sm text-slate-500">Ajusta la busqueda o revisa si existen usuarios registrados.</p>
    </div>
  );
}

export function UsuariosAdmin({ supabase, user }) {
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [columnFilters, setColumnFilters] = React.useState({});
  const [hiddenColumns, setHiddenColumns] = React.useState({});
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [open, setOpen] = React.useState(false);
  const [permissionsOpen, setPermissionsOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [permissionsUser, setPermissionsUser] = React.useState(null);
  const [permissionRows, setPermissionRows] = React.useState({});
  const [sort, setSort] = React.useState({ key: 'created', direction: 'desc' });
  const [form, setForm] = React.useState({ nombre: '', apellido: '', tipo_doc: 'DNI', documento: '', email_auth: '', email_contacto: '', telefono: '', direccion: '', empresa: '', moneda: 'PEN', role: 'user' });

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
      email_auth: row.email_auth || '',
      email_contacto: row.email_contacto || row.email_auth || '',
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
      p_email_auth: form.email_auth,
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
    if (!(await confirmAction(`${next ? 'Activar' : 'Desactivar'} usuario ${row.email_auth || row.email_contacto || row.nombre || ''}?`))) return;
    const { error } = await updateAdminUserState(supabase, row.id, next);
    if (error) return notify(error.message);
    notify(next ? 'Usuario activado.' : 'Usuario desactivado.', 'success');
    load();
  }

  async function remove(row) {
    if (row.id === user.id) return notify('No puedes eliminar tu propio usuario.');
    if (!(await confirmAction(`Eliminar definitivamente el usuario ${row.email_auth || row.email_contacto || row.nombre || ''}? Esta accion borrara su cuenta de acceso y no se puede deshacer.`))) return;
    const { error } = await deleteAdminUser(supabase, row.id);
    if (error) return notify(error.message);
    notify('Usuario eliminado definitivamente.', 'success');
    load();
  }

  async function openPermissions(row) {
    if (row.id === user.id) return notify('No necesitas configurar permisos para tu propio usuario.');
    setPermissionsUser(row);
    const defaults = MODULE_PERMISSIONS.reduce((map, [modulo]) => ({
      ...map,
      [modulo]: { modulo, can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false },
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
    setPermissionRows((current) => {
      const next = { ...current[moduleId], modulo: moduleId, [field]: checked };
      if (field !== 'can_view' && checked) next.can_view = true;
      if (field === 'can_view' && !checked) {
        next.can_create = false;
        next.can_edit = false;
        next.can_delete = false;
        next.can_export = false;
      }
      return { ...current, [moduleId]: next };
    });
  }

  function applyPreset(preset) {
    setPermissionRows((current) => {
      const reset = MODULE_PERMISSIONS.reduce((map, [moduleId]) => ({ ...map, [moduleId]: makePermissionRow(moduleId, 'none') }), {});
      return applyModulesPermission({ ...reset, ...current, ...reset }, preset.modules, preset.mode);
    });
  }

  function applyGroup(group, mode) {
    setPermissionRows((current) => applyModulesPermission(current, group.modules, mode));
  }

  function visibleCount(group) {
    return group.modules.filter((moduleId) => permissionRows[moduleId]?.can_view).length;
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

  function sortBy(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function updateColumnFilter(key, value) {
    setColumnFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleColumn(key) {
    setHiddenColumns((current) => ({ ...current, [key]: !current[key] }));
  }

  function resetTableOptions() {
    setColumnFilters({});
    setHiddenColumns({});
    setPageSize(10);
    setPage(1);
  }

  const filtered = React.useMemo(() => rows.filter((row) => {
    const content = `${row.nombre || ''} ${row.apellido || ''} ${row.email_auth || ''} ${row.email_contacto || ''} ${row.telefono || ''} ${row.role || ''} ${getEmailConfirmation(row).text}`;
    if (!content.toLowerCase().includes(query.toLowerCase())) return false;
    const exportRow = rowToExport(row);
    return userColumns.every((column) => {
      const filter = String(columnFilters[column.key] || '').trim().toLowerCase();
      if (!filter) return true;
      return String(exportRow[column.key] || '').toLowerCase().includes(filter);
    });
  }), [rows, query, columnFilters]);

  const sortedRows = React.useMemo(() => [...filtered].sort((a, b) => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const values = {
      name: [userName(a), userName(b)],
      email: [a.email_auth || a.email_contacto || '', b.email_auth || b.email_contacto || ''],
      emailConfirmed: [getEmailConfirmation(a).text, getEmailConfirmation(b).text],
      contact: [a.email_contacto || a.telefono || '', b.email_contacto || b.telefono || ''],
      role: [a.role || 'user', b.role || 'user'],
      status: [getUserStatus(a).text, getUserStatus(b).text],
      created: [a.created_at || '', b.created_at || ''],
    };
    const [left, right] = values[sort.key] || ['', ''];
    return textValue(left).localeCompare(textValue(right)) * direction;
  }), [filtered, sort]);

  const visibleColumns = React.useMemo(() => userColumns.filter((column) => !hiddenColumns[column.key]), [hiddenColumns]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = React.useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, safePage, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [query, columnFilters, pageSize]);

  const activeCount = rows.filter((row) => row.activo && !row.deleted_at).length;
  const inactiveCount = rows.filter((row) => !row.activo && !row.deleted_at).length;
  const deletedCount = rows.filter((row) => row.deleted_at).length;
  const permissionCount = Object.values(permissionRows).reduce((sum, row) => sum + PERMISSION_FIELDS.filter(([field]) => row[field]).length, 0);
  const statValues = { total: rows.length, active: activeCount, inactive: inactiveCount, deleted: deletedCount };
  const maxStat = Math.max(rows.length, 1);
  const exportRows = sortedRows.map(rowToExport);

  async function exportExcel() {
    notify('Descargando reporte', 'info');
    const XLSX = await import('xlsx-js-style');
    const columns = visibleColumns.map((column) => column.label);
    const data = exportRows.map((row) => visibleColumns.map((column) => row[column.key]));
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['FinTrack Pro - Usuarios'],
      [`Generado: ${new Date().toLocaleString('es-PE')}`],
      [],
      columns,
      ...data,
      [`Total registros: ${data.length}`],
    ]);
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(columns.length - 1, 0) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(columns.length - 1, 0) } },
      { s: { r: data.length + 4, c: 0 }, e: { r: data.length + 4, c: Math.max(columns.length - 1, 0) } },
    ];
    worksheet['!cols'] = columns.map((column, index) => ({
      wch: Math.max(14, column.length, ...data.map((row) => String(row[index] || '').length).slice(0, 100)) + 2,
    }));
    const headerRow = 3;
    columns.forEach((_, index) => {
      const ref = XLSX.utils.encode_cell({ r: headerRow, c: index });
      if (worksheet[ref]) {
        worksheet[ref].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '0F766E' } },
          alignment: { horizontal: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'D9E3EA' } },
            bottom: { style: 'thin', color: { rgb: 'D9E3EA' } },
            left: { style: 'thin', color: { rgb: 'D9E3EA' } },
            right: { style: 'thin', color: { rgb: 'D9E3EA' } },
          },
        };
      }
    });
    for (let r = 4; r < data.length + 4; r += 1) {
      columns.forEach((_, c) => {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (worksheet[ref]) {
          worksheet[ref].s = {
            fill: { fgColor: { rgb: r % 2 === 0 ? 'F8FAFC' : 'FFFFFF' } },
            border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
          };
        }
      });
    }
    ['A1', 'A2'].forEach((ref, index) => {
      if (worksheet[ref]) worksheet[ref].s = { font: { bold: index === 0, sz: index === 0 ? 16 : 11, color: { rgb: index === 0 ? '0F172A' : '64748B' } } };
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');
    XLSX.writeFile(workbook, `usuarios-${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true });
  }

function exportPdf() {
    notify('Descargando reporte', 'info');
    const columns = visibleColumns.map((column) => column.label);
    const htmlRows = exportRows.map((row) => `<tr>${visibleColumns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join('')}</tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Usuarios</title><style>
      body{font-family:Arial,sans-serif;color:#0f172a;padding:28px}
      h1{margin:0 0 4px;font-size:22px}p{margin:0 0 22px;color:#64748b}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#0f766e;color:#fff;text-align:left;padding:10px;border:1px solid #0f766e}
      td{padding:9px;border:1px solid #dbe5ee}
      tr:nth-child(even) td{background:#f8fafc}
      .total{margin-top:14px;font-weight:700}
    </style></head><body><h1>FinTrack Pro - Usuarios</h1><p>Generado: ${escapeHtml(new Date().toLocaleString('es-PE'))}</p><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${htmlRows || `<tr><td colspan="${columns.length}">Sin datos</td></tr>`}</tbody></table><div class="total">Total registros: ${exportRows.length}</div><script>window.print()</script></body></html>`;
    const win = window.open('', '_blank');
    if (!win) return notify('El navegador bloqueó la ventana del reporte.');
    win.document.write(html);
    win.document.close();
  }

  return (
    <section className="tailwind-page space-y-5">
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-50 shadow-[0_22px_55px_rgba(15,23,42,0.10)]">
        <div className="border-b border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <Users size={23} />
              </span>
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-950">Gestión de usuarios</h3>
                <p className="text-sm font-medium text-slate-500">Administra usuarios, estados y permisos del sistema.</p>
              </div>
            </div>
            <div className="relative w-full xl:w-[460px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar usuario, correo o rol..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const Icon = item.icon;
            const styles = statStyles[item.tone];
            const value = statValues[item.key];
            const width = `${Math.max(6, Math.round((value / maxStat) * 100))}%`;
            return (
              <div key={item.key} className={`relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.14)] ${styles.card}`}>
                <span className={`absolute inset-x-0 top-0 h-1 ${styles.accent}`} />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <span className={`text-xs font-black uppercase tracking-wide ${styles.label}`}>{item.label}</span>
                    <strong className={`mt-1 block text-2xl font-black ${styles.value}`}>{value}</strong>
                  </div>
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${styles.icon}`}>
                    <Icon size={19} />
                  </span>
                </div>
                <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
                  <span className={`block h-full rounded-full ${styles.bar}`} style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-5">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm font-semibold text-slate-500">
              Mostrando {sortedRows.length ? ((safePage - 1) * pageSize) + 1 : 0}-{Math.min(safePage * pageSize, sortedRows.length)} de {sortedRows.length} usuario(s)
            </div>
            <div className="relative flex flex-wrap gap-2">
              <button type="button" className={neutralButton} onClick={() => setOptionsOpen((value) => !value)}>
                <SlidersHorizontal size={16} />Opciones
              </button>
              <button type="button" className={neutralButton} onClick={exportPdf}>
                <FileText size={16} />Exportar PDF
              </button>
              <button type="button" className={primaryButton} onClick={exportExcel}>
                <FileSpreadsheet size={16} />Exportar Excel
              </button>
              {optionsOpen && (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[90] w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <strong className="text-sm font-black text-slate-900">Vista web</strong>
                    <button type="button" className="border-0 bg-transparent p-0 text-xs font-black text-emerald-700 underline-offset-2 transition hover:text-emerald-900 hover:underline" onClick={resetTableOptions}>Restablecer</button>
                  </div>
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {[5, 10, 20].map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`rounded-xl border px-3 py-2 text-xs font-black transition ${pageSize === size ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                        onClick={() => setPageSize(size)}
                      >
                        {size === 5 ? 'Compacta' : size === 10 ? 'Comoda' : 'Amplia'}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">Columnas</span>
                    {userColumns.map((column) => (
                      <button key={column.key} type="button" className="flex h-8 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-bold text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50/50" onClick={() => toggleColumn(column.key)}>
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded ${!hiddenColumns[column.key] ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white text-transparent'}`}>
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span>{column.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {sortedRows.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1000px] border-collapse bg-white text-left">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {visibleColumns.map((column) => (
                        <th key={column.key} className="border-b border-slate-100 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          <div className="flex items-center gap-2">
                            {column.label}
                            <SortButton active={sort.key === column.key} direction={sort.direction} onClick={() => sortBy(column.key)} />
                          </div>
                        </th>
                      ))}
                      <th className="border-b border-slate-100 px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-500">Acciones</th>
                    </tr>
                    <tr>
                      {visibleColumns.map((column) => (
                        <th key={`filter-${column.key}`} className="border-b border-slate-100 bg-white px-4 py-2">
                          <input
                            value={columnFilters[column.key] || ''}
                            onChange={(event) => updateColumnFilter(column.key, event.target.value)}
                            placeholder={`Filtrar ${column.label.toLowerCase()}...`}
                            className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </th>
                      ))}
                      <th className="border-b border-slate-100 bg-white px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const status = getUserStatus(row);
                      const exportRow = rowToExport(row);
                      return (
                        <tr key={row.id} className="group border-b border-slate-100 transition last:border-b-0 hover:bg-emerald-50/30">
                          {visibleColumns.map((column) => (
                            <td key={`${row.id}-${column.key}`} className="px-4 py-3.5">
                              {column.key === 'name' ? (
                                <div className="flex items-center gap-3">
                                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-black uppercase text-white shadow-sm ring-4 ring-emerald-50">
                                    {(row.nombre?.[0] || 'U')}{(row.apellido?.[0] || '')}
                                  </div>
                                  <div>
                                    <strong className="block text-sm font-black text-slate-900">{userName(row)}</strong>
                                    <span className="text-xs font-semibold text-slate-500">{row.documento || 'Sin documento'}</span>
                                  </div>
                                </div>
                              ) : column.key === 'role' ? (
                                <StatusBadge tone={row.role === 'admin' ? 'green' : 'gray'}>{row.role || 'user'}</StatusBadge>
                              ) : column.key === 'emailConfirmed' ? (
                                <StatusBadge tone={getEmailConfirmation(row).tone}>{getEmailConfirmation(row).text}</StatusBadge>
                              ) : column.key === 'status' ? (
                                <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
                              ) : (
                                <span className="text-sm font-semibold text-slate-700">{exportRow[column.key]}</span>
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3.5">
                            {row.id === user.id ? (
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">Usuario actual</span>
                            ) : (
                              <div className="flex flex-wrap items-center justify-end gap-1.5 opacity-75 transition group-hover:opacity-100">
                                <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700" type="button" title="Editar" onClick={() => openEdit(row)}><Pencil size={14} /></button>
                                <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700" type="button" title="Permisos" onClick={() => openPermissions(row)}><KeyRound size={14} /></button>
                                <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-amber-50 hover:text-amber-700" type="button" title={row.activo ? 'Desactivar' : 'Activar'} onClick={() => toggle(row)}><UserCheck size={14} /></button>
                                <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700" type="button" title="Eliminar" onClick={() => remove(row)}><Trash2 size={14} /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 bg-slate-50 p-3 lg:hidden">
                {pageRows.map((row) => {
                  const status = getUserStatus(row);
                  return (
                    <article key={row.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-black uppercase text-white shadow-sm ring-4 ring-emerald-50">
                            {(row.nombre?.[0] || 'U')}{(row.apellido?.[0] || '')}
                          </span>
                          <div className="min-w-0">
                            <strong className="block truncate text-base font-black text-slate-900">{userName(row)}</strong>
                            <span className="block truncate text-xs font-semibold text-slate-500">{row.email_auth || row.email_contacto || '-'}</span>
                          </div>
                        </div>
                        <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
                      </div>
                      <div className="grid grid-cols-3 gap-px border-y border-slate-100 bg-slate-100 text-center">
                        <div className="bg-white px-2 py-3">
                          <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">Rol</span>
                          <strong className="block truncate text-xs text-slate-800">{row.role || 'user'}</strong>
                        </div>
                        <div className="bg-white px-2 py-3">
                          <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">Contacto</span>
                          <strong className="block truncate text-xs text-slate-800">{row.telefono || row.email_contacto || '-'}</strong>
                        </div>
                        <div className="bg-white px-2 py-3">
                          <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">Registro</span>
                          <strong className="block truncate text-xs text-slate-800">{row.created_at ? new Date(row.created_at).toLocaleDateString('es-PE') : '-'}</strong>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-400">Correo</span>
                        <StatusBadge tone={getEmailConfirmation(row).tone}>{getEmailConfirmation(row).text}</StatusBadge>
                      </div>
                      {row.id === user.id ? (
                        <div className="p-3">
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">Usuario actual</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 p-3">
                          <button className="grid min-h-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition active:scale-95" type="button" aria-label="Editar" onClick={() => openEdit(row)}><Pencil size={17} /></button>
                          <button className="grid min-h-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition active:scale-95" type="button" aria-label="Permisos" onClick={() => openPermissions(row)}><KeyRound size={17} /></button>
                          <button className={`grid min-h-12 place-items-center rounded-2xl border shadow-sm transition active:scale-95 ${row.activo ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`} type="button" aria-label={row.activo ? 'Desactivar' : 'Activar'} onClick={() => toggle(row)}><UserCheck size={17} /></button>
                          <button className="grid min-h-12 place-items-center rounded-2xl border border-red-200 bg-red-50 text-red-600 shadow-sm transition active:scale-95" type="button" aria-label="Eliminar" onClick={() => remove(row)}><Trash2 size={17} /></button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-slate-500">Página {safePage} de {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button type="button" className={neutralButton} disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button>
                  <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <button type="button" className={neutralButton} disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente</button>
                </div>
              </div>
            </div>
          ) : <EmptyUsers />}
        </div>
      </div>

      <TailwindModal open={open} title="Editar usuario" onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="grid gap-4 p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
              <TextField label="Apellido" value={form.apellido} onChange={(v) => setForm({ ...form, apellido: v })} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField label="Tipo de documento" value={form.tipo_doc} onChange={(v) => setForm({ ...form, tipo_doc: v })}>
                <option>DNI</option><option>RUC</option><option>CE</option><option>Pasaporte</option>
              </SelectField>
              <TextField label="Documento" value={form.documento} onChange={(v) => setForm({ ...form, documento: v })} />
            </div>
            <TextField label="Correo de acceso" type="email" value={form.email_auth} onChange={(v) => setForm({ ...form, email_auth: v })} />
            <TextField label="Email de contacto" type="email" value={form.email_contacto} onChange={(v) => setForm({ ...form, email_contacto: v })} />
            <TextField label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
            <TextField label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
            <TextField label="Empresa / Negocio" value={form.empresa} onChange={(v) => setForm({ ...form, empresa: v })} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField label="Moneda" value={form.moneda} onChange={(v) => setForm({ ...form, moneda: v })}>
                <option value="PEN">Soles (S/)</option><option value="USD">Dólares ($)</option><option value="EUR">Euros (€)</option>
              </SelectField>
              <SelectField label="Rol" value={form.role} onChange={(v) => setForm({ ...form, role: v })}>
                <option value="user">Usuario</option><option value="admin">Administrador</option>
              </SelectField>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/80 p-4">
            <button type="button" className={neutralButton} onClick={() => setOpen(false)}>Cancelar</button>
            <button className={primaryButton}><Check size={16} />Guardar cambios</button>
          </div>
        </form>
      </TailwindModal>

      <TailwindModal open={permissionsOpen} title={`Permisos de ${permissionsUser?.nombre || 'usuario'}`} onClose={() => setPermissionsOpen(false)} size="wide">
        <form onSubmit={savePermissionRows}>
          <div className="space-y-5 p-6">
            <div className="flex flex-col gap-4 rounded-3xl border border-slate-300 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm"><ShieldCheck size={23} /></span>
                <div>
                  <strong className="block text-lg text-slate-900">Configura accesos por módulo</strong>
                  <p className="mt-1 text-sm text-slate-500">Usa una plantilla o ajusta permisos específicos por módulo.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
                <span className="block text-2xl font-black text-emerald-700">{permissionCount}</span>
                <span className="text-xs font-black uppercase tracking-wide text-emerald-700">permisos activos</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-300 bg-slate-100/70 p-4 shadow-inner">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <strong className="block text-sm uppercase tracking-wide text-slate-800">Plantillas rápidas</strong>
                  <small className="text-slate-500">Punto de partida para no marcar permiso por permiso.</small>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {PERMISSION_PRESETS.map((preset) => (
                  <button type="button" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-md" key={preset.id} onClick={() => applyPreset(preset)}>
                    <strong className="block text-sm text-slate-900">{preset.label}</strong>
                    <span className="block text-xs text-slate-500">{preset.description}</span>
                  </button>
                ))}
                <button type="button" className="rounded-2xl border border-red-300 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-red-50 hover:shadow-md" onClick={() => setPermissionRows(MODULE_PERMISSIONS.reduce((map, [moduleId]) => ({ ...map, [moduleId]: makePermissionRow(moduleId, 'none') }), {}))}>
                  <strong className="block text-sm text-red-700">Sin acceso</strong>
                  <span className="block text-xs text-red-500">Apaga todos los módulos</span>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-300 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
              <div className="mb-3">
                <strong className="block text-sm uppercase tracking-wide text-slate-800">Accesos por grupo</strong>
                <small className="text-slate-500">Activa secciones completas sin marcar módulo por módulo.</small>
              </div>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                {PERMISSION_GROUPS.map((group) => (
                  <div className={`rounded-2xl border p-3 transition ${visibleCount(group) > 0 ? 'border-emerald-200 bg-emerald-50/40 shadow-sm' : 'border-slate-200 bg-slate-100/70'}`} key={group.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="block text-slate-900">{group.label}</strong>
                        <span className="text-sm text-slate-500">{visibleCount(group)}/{group.modules.length} módulos visibles</span>
                      </div>
                      {visibleCount(group) > 0 && (
                        <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">Activo</span>
                      )}
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                      <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((visibleCount(group) / group.modules.length) * 100)}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 hover:border-slate-400" type="button" onClick={() => applyGroup(group, 'read')}>Ver</button>
                      <button className="rounded-xl border border-slate-900 bg-slate-900 px-2 py-2 text-xs font-bold text-white hover:bg-slate-800" type="button" onClick={() => applyGroup(group, 'full')}>Operar</button>
                      <button className="rounded-xl border border-red-200 bg-white px-2 py-2 text-xs font-bold text-red-600 hover:bg-red-50" type="button" onClick={() => applyGroup(group, 'none')}>Quitar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <strong className="block text-sm uppercase tracking-wide text-slate-800">Detalle por módulo</strong>
                <small className="text-slate-500">Ajusta permisos puntuales solo cuando sea necesario.</small>
              </div>
              <small className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-500">Ver activa el modulo en el menu</small>
            </div>
            <div className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
              {MODULE_PERMISSIONS.map(([moduleId, label]) => {
                const row = permissionRows[moduleId] || {};
                const activePermissionCount = PERMISSION_FIELDS.filter(([field]) => row[field]).length;
                return (
                  <div className={`grid gap-4 border-b border-slate-200 p-4 last:border-b-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center ${row.can_view ? 'bg-white' : 'bg-slate-100/70'}`} key={moduleId}>
                    <div className="flex items-start justify-between gap-3 lg:block">
                      <div>
                        <strong className="block text-slate-900">{label}</strong>
                        <small className="text-slate-500">{activePermissionCount} permisos activos</small>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ring-1 lg:mt-2 ${row.can_view ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                        {row.can_view && <Check size={13} />}
                        {row.can_view ? 'Activo' : 'Oculto'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                      {PERMISSION_FIELDS.map(([field, text]) => (
                        <label className={`flex cursor-pointer items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-sm font-black transition ${row[field] ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'}`} key={field}>
                          <span>{text}</span>
                          <span className={`relative h-5 w-9 rounded-full transition ${row[field] ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${row[field] ? 'left-4' : 'left-0.5'}`} />
                          </span>
                          <input className="sr-only" type="checkbox" checked={!!row[field]} onChange={(event) => setPerm(moduleId, field, event.target.checked)} />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white/95 p-4">
            <button type="button" className={neutralButton} onClick={() => setPermissionsOpen(false)}>Cancelar</button>
            <button className={primaryButton}><Check size={16} />Guardar permisos</button>
          </div>
        </form>
      </TailwindModal>
    </section>
  );
}


