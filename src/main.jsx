import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart3,
  Banknote,
  Building2,
  CalendarClock,
  Check,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  Search,
  Settings,
  ArrowRightLeft,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react';
import './styles.css';

const today = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);
const money = (value) =>
  `S/ ${Number(value || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const dateFmt = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-PE') : '-');

let notifyHandler = null;
let confirmHandler = null;

function notify(message, type = 'error') {
  if (notifyHandler) notifyHandler({ message, type });
}

function confirmAction(message) {
  if (confirmHandler) return confirmHandler(message);
  return Promise.resolve(false);
}

function createStoredClient() {
  const url = localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return url && key ? createClient(url, key) : null;
}

function App() {
  const [supabase, setSupabase] = React.useState(createStoredClient);
  const [session, setSession] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [page, setPage] = React.useState('dashboard');
  const [message, setMessage] = React.useState('');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [toast, setToast] = React.useState(null);
  const [confirmState, setConfirmState] = React.useState(null);
  const [installPrompt, setInstallPrompt] = React.useState(null);

  React.useEffect(() => {
    notifyHandler = ({ message: nextMessage, type }) => {
      setToast({ message: nextMessage, type });
      window.clearTimeout(window.__fintrackToastTimer);
      window.__fintrackToastTimer = window.setTimeout(() => setToast(null), 4500);
    };
    confirmHandler = (question) => new Promise((resolve) => setConfirmState({ question, resolve }));
    return () => {
      notifyHandler = null;
      confirmHandler = null;
    };
  }, []);

  React.useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  React.useEffect(() => {
    async function loadProfile() {
      if (!supabase || !session?.user) {
        setProfile(null);
        return;
      }
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (error) setMessage(error.message);
      setProfile(data || {});
    }
    loadProfile();
  }, [supabase, session, refreshKey]);

  if (!supabase) return <Setup onReady={setSupabase} />;
  if (!session) return <Auth supabase={supabase} message={message} setMessage={setMessage} />;

  const isAdmin = profile?.role === 'admin';
  const pages = [
    ['principal', [
      ['dashboard', 'Dashboard', LayoutDashboard, true],
      ['clientes', 'Clientes', Users, true],
    ]],
    ['finanzas', [
      ['cuentas', 'Cuentas bancarias', Building2, true],
      ['deudas', 'Deudas', CreditCard, true],
      ['pagos', 'Pagos', Banknote, true],
      ['movimientos', 'Ingresos / Egresos', Wallet, true],
    ]],
    ['análisis', [['reportes', 'Reportes', BarChart3, true]]],
    ['sistema', [
      ['perfil', 'Mi perfil', UserCircle, true],
      ['config', 'Configuración', Settings, isAdmin],
    ]],
  ];

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  function openPage(nextPage) {
    if (nextPage === 'config' && !isAdmin) return;
    setPage(nextPage);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="brand">
            <div className="brand-icon"><TrendingUp size={20} /></div>
            <div>
              <div className="brand-name">FinTrack Pro</div>
              <div className="brand-sub">Panel de control</div>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {pages.map(([section, items]) => (
            <React.Fragment key={section}>
              <div className="nav-section-label">{section}</div>
              {items.filter(([, , , visible]) => visible).map(([id, label, Icon]) => (
                <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => openPage(id)}>
                  <Icon size={18} /> {label}
                </button>
              ))}
            </React.Fragment>
          ))}
          <button className="nav-item logout" onClick={logout}><LogOut size={18} /> Cerrar sesión</button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-mini" onClick={() => setPage('perfil')}>
            <div className="user-avatar">{initials(profile, session.user.email)}</div>
            <div className="user-info">
              <div className="name">{fullName(profile) || session.user.email}</div>
              <div className="role">{isAdmin ? 'Administrador' : 'Usuario'}</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbar-left">
            <h2>{pageTitle(page, isAdmin)[0]}</h2>
            <p>{pageTitle(page, isAdmin)[1]}</p>
          </div>
          <div className="topbar-actions">
            {installPrompt && <button className="btn btn-primary" onClick={async () => {
              await installPrompt.prompt();
              setInstallPrompt(null);
            }}>Instalar app</button>}
          </div>
        </div>
        {message && <div className="alert alert-danger">{message}</div>}
        <div className="page active">
          {page === 'dashboard' && <Dashboard supabase={supabase} user={session.user} isAdmin={isAdmin} />}
          {page === 'clientes' && <Clientes supabase={supabase} user={session.user} />}
          {page === 'cuentas' && <Cuentas supabase={supabase} user={session.user} />}
          {page === 'deudas' && <Deudas supabase={supabase} user={session.user} isAdmin={isAdmin} />}
          {page === 'pagos' && <Pagos supabase={supabase} user={session.user} isAdmin={isAdmin} />}
          {page === 'movimientos' && <Movimientos supabase={supabase} user={session.user} isAdmin={isAdmin} />}
          {page === 'reportes' && <Reportes supabase={supabase} user={session.user} />}
          {page === 'perfil' && <Perfil supabase={supabase} user={session.user} profile={profile} onSaved={() => setRefreshKey((x) => x + 1)} />}
          {page === 'config' && isAdmin && <Config onReady={setSupabase} />}
        </div>
      </main>
      <AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} />
    </div>
  );
}

function initials(profile, email) {
  return ((profile?.nombre?.[0] || '') + (profile?.apellido?.[0] || '')).toUpperCase() || email?.[0]?.toUpperCase() || '?';
}
function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
}
function pageTitle(page, isAdmin) {
  const labels = {
    dashboard: ['Dashboard', 'Resumen general de finanzas'],
    clientes: ['Clientes', 'Gestión de clientes y deudores'],
    cuentas: ['Cuentas bancarias', 'Administra tus cuentas y billeteras'],
    deudas: ['Deudas', 'Registro y seguimiento de deudas'],
    pagos: ['Pagos', 'Historial de pagos recibidos'],
    movimientos: ['Ingresos y egresos', 'Movimientos generales de caja'],
    reportes: ['Reportes', 'Análisis financiero'],
    perfil: ['Mi perfil', 'Información personal y seguridad'],
    config: ['Configuración', 'Conexión a base de datos'],
  };
  return labels[page] || ['FinTrack', ''];
}
function calcEstado(deuda) {
  const pendiente = Number(deuda.monto_total || 0) - Number(deuda.monto_pagado || 0);
  if (pendiente <= 0) return 'pagado';
  if (!deuda.fecha_vencimiento) return 'al_dia';
  const diff = (new Date(`${deuda.fecha_vencimiento}T00:00:00`) - new Date(new Date().toDateString())) / 86400000;
  if (diff < 0) return 'vencido';
  if (diff <= 7) return 'por_vencer';
  return 'al_dia';
}
function badge(estado) {
  const map = {
    al_dia: ['badge-green', 'Al día'],
    por_vencer: ['badge-yellow', 'Por vencer'],
    vencido: ['badge-red', 'Vencido'],
    pagado: ['badge-blue', 'Pagado'],
    ingreso: ['badge-green', 'Ingreso'],
    egreso: ['badge-red', 'Egreso'],
  };
  const [className, text] = map[estado] || ['badge-gray', estado];
  return <span className={`badge ${className}`}>{text}</span>;
}

function Setup({ onReady }) {
  return <AuthCard title="Conectar Supabase"><Config onReady={onReady} compact /></AuthCard>;
}

function Auth({ supabase, message, setMessage }) {
  const [mode, setMode] = React.useState('login');
  const [form, setForm] = React.useState({ nombre: '', apellido: '', email: '', password: '' });
  const [showPassword, setShowPassword] = React.useState(false);
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) setMessage(error.message);
      return;
    }
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { nombre: form.nombre, apellido: form.apellido }, emailRedirectTo: window.location.origin },
    });
    if (error) {
      const rateLimited = error.status === 429 || /rate limit|email rate/i.test(error.message);
      setMessage(rateLimited ? 'Supabase alcanzó el límite temporal de correos. Espera o configura SMTP propio.' : error.message);
    } else {
      setMessage('Correo de confirmación enviado. Revisa bandeja de entrada y spam.');
    }
  }

  return (
    <AuthCard title="FinTrack Pro">
      <div className="auth-tabs">
        <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Iniciar sesión</button>
        <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Registrarse</button>
      </div>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <div className="form-row">
            <Field label="Nombre" value={form.nombre} onChange={(value) => setField('nombre', value)} />
            <Field label="Apellido" value={form.apellido} onChange={(value) => setField('apellido', value)} />
          </div>
        )}
        <Field label="Correo electrónico" type="email" value={form.email} onChange={(value) => setField('email', value)} required />
        <Field
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          value={form.password}
          onChange={(value) => setField('password', value)}
          required
          minLength={8}
          rightElement={<button className="input-action" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
        />
        <button className="btn-full">{mode === 'login' ? 'Entrar al sistema' : 'Crear cuenta de cliente'}</button>
        {message && <div className="auth-error">{message}</div>}
      </form>
    </AuthCard>
  );
}

function AuthCard({ title, children }) {
  return (
    <div id="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon"><TrendingUp /></div>
          <h1>{title}</h1>
          <p>Sistema de gestión financiera</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function AppDialogs({ toast, onCloseToast, confirmState, setConfirmState }) {
  function answer(value) {
    confirmState?.resolve(value);
    setConfirmState(null);
  }
  return (
    <>
      {toast && (
        <div className={`toast toast-${toast.type || 'error'}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={onCloseToast}>X</button>
        </div>
      )}
      {confirmState && (
        <div className="dialog-overlay">
          <div className="dialog-card">
            <h3>Confirmar acción</h3>
            <p>{confirmState.question}</p>
            <div className="dialog-actions">
              <button className="btn" type="button" onClick={() => answer(false)}>Cancelar</button>
              <button className="btn btn-danger" type="button" onClick={() => answer(true)}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, type = 'text', value, onChange, required = false, minLength, placeholder, rightElement }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className={rightElement ? 'input-wrap' : ''}>
        <input type={type} value={value} required={required} minLength={minLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        {rightElement}
      </div>
    </div>
  );
}
function SelectField({ label, value, onChange, children }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </div>
  );
}

function Config({ onReady, compact = false }) {
  const [url, setUrl] = React.useState(localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || '');
  const [key, setKey] = React.useState(localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const [status, setStatus] = React.useState('');

  async function save(event) {
    event.preventDefault();
    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) {
      setStatus('La URL debe tener formato https://proyecto.supabase.co');
      return;
    }
    const client = createClient(cleanUrl, key.trim());
    const { error } = await client.from('profiles').select('id').limit(1);
    if (error && !/profiles|schema cache|relation/i.test(error.message) && error.code !== '42501') {
      setStatus(error.message);
      return;
    }
    localStorage.setItem('sb_url', cleanUrl);
    localStorage.setItem('sb_key', key.trim());
    setStatus('Conexión guardada correctamente.');
    onReady(client);
  }

  return (
    <div className={compact ? '' : 'profile-section'}>
      <div className={compact ? '' : 'card'}>
        {!compact && <div className="card-header"><h3>Configuración del sistema</h3></div>}
        <div className={compact ? '' : 'card-body'}>
          <div className="alert alert-warning">Usa únicamente la clave Publishable o anon. Nunca uses service_role.</div>
          <form onSubmit={save}>
            <Field label="Supabase URL" value={url} onChange={setUrl} placeholder="https://xxxx.supabase.co" />
            <Field label="Publishable / Anon Key" type="password" value={key} onChange={setKey} />
            <button className="btn btn-primary">Guardar conexión</button>
            {status && <div className="connection-status success">{status}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ supabase, user, isAdmin }) {
  const [data, setData] = React.useState({ deudas: [], pagos: [], cuentas: [], movimientos: [] });
  React.useEffect(() => {
    async function load() {
      const deudasQ = supabase.from('deudas').select('*,clientes(nombre,apellido)');
      const pagosQ = supabase.from('pagos').select('*,clientes(nombre,apellido),deudas(descripcion)').order('fecha', { ascending: false }).limit(30);
      const movQ = supabase.from('movimientos').select('*');
      const cuentasQ = supabase.from('cuentas').select('*').eq('admin_id', user.id);
      const [deudas, pagos, cuentas, movimientos] = await Promise.all([
        deudasQ.eq('admin_id', user.id),
        pagosQ.eq('admin_id', user.id),
        cuentasQ,
        movQ,
      ]);
      setData({ deudas: deudas.data || [], pagos: pagos.data || [], cuentas: cuentas.data || [], movimientos: movimientos.data || [] });
    }
    load();
  }, [supabase, user.id, isAdmin]);
  const pendiente = data.deudas.reduce((sum, d) => sum + Math.max(0, Number(d.monto_total || 0) - Number(d.monto_pagado || 0)), 0);
  const ingresos = data.movimientos.filter((m) => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto || 0), 0);
  const egresos = data.movimientos.filter((m) => m.tipo === 'egreso').reduce((sum, m) => sum + Number(m.monto || 0), 0);
  const pagosMes = data.pagos.filter((p) => p.fecha?.startsWith(month())).reduce((sum, p) => sum + Number(p.monto || 0), 0);
  const porVencer = data.deudas.filter((d) => ['por_vencer', 'vencido'].includes(calcEstado(d))).slice(0, 5);

  return (
    <>
      <div className="metrics-grid">
        <MetricCard icon={<Wallet />} label="Balance cuentas" value={money(data.cuentas.reduce((s, c) => s + Number(c.saldo || 0), 0))} helper={`${data.cuentas.length} cuentas activas`} />
        <MetricCard icon={<CreditCard />} label="Pendiente por cobrar" value={money(pendiente)} helper={`${data.deudas.filter((d) => calcEstado(d) !== 'pagado').length} deudas activas`} danger />
        <MetricCard icon={<Banknote />} label="Pagos del mes" value={money(pagosMes)} helper={`${data.pagos.filter((p) => p.fecha?.startsWith(month())).length} pagos`} />
        <MetricCard icon={<TrendingUp />} label="Ingresos / Egresos" value={`${money(ingresos)} / ${money(egresos)}`} helper="Movimientos generales" />
      </div>
      <div className="grid-2">
        <ListCard title="Deudas por vencer" empty="Sin deudas por vencer" items={porVencer.map((d) => `${d.clientes?.nombre || ''} - ${d.descripcion}: ${money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0))}`)} />
        <ListCard title="Últimos pagos registrados" empty="Sin pagos registrados" items={data.pagos.slice(0, 5).map((p) => `${dateFmt(p.fecha)} - ${p.clientes?.nombre || ''}: ${money(p.monto)}`)} />
      </div>
    </>
  );
}

function MetricCard({ icon, label, value, helper, danger = false }) {
  return <div className="metric-card"><div className="metric-label">{icon}{label}</div><div className={`metric-value ${danger ? 'danger-text' : ''}`}>{value}</div><div className="metric-change neutral">{helper}</div></div>;
}
function ListCard({ title, items, empty }) {
  return <div className="card"><div className="card-header"><h3>{title}</h3></div><div className="card-body">{items.length ? items.map((x) => <div className="list-row" key={x}>{x}</div>) : <div className="empty-state"><p>{empty}</p></div>}</div></div>;
}

function Clientes({ supabase, user }) {
  const [clientes, setClientes] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const emptyForm = { nombre: '', apellido: '', tipo_doc: 'DNI', documento: '', telefono: '', email: '', direccion: '', notas: '' };
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(() => supabase.from('clientes').select('*').eq('admin_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setClientes(data || [])), [supabase, user.id]);
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
    if (!(await confirmAction(`Eliminar cliente ${cliente.nombre || ''} ${cliente.apellido || ''}?`))) return;
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id).eq('admin_id', user.id);
    if (error) {
      notify(error.message);
      return;
    }
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (!form.nombre) return;
    const { error } = editingId
      ? await supabase.from('clientes').update(form).eq('id', editingId).eq('admin_id', user.id)
      : await supabase.from('clientes').insert({ ...form, admin_id: user.id });
    if (error) {
      notify(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  const filtered = clientes.filter((c) => `${c.nombre} ${c.apellido} ${c.email} ${c.documento}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <TableSection
        title="Clientes"
        search={query}
        setSearch={setQuery}
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo cliente</button>}
        columns={['Cliente', 'Documento', 'Teléfono', 'Email', 'Dirección']}
        rows={filtered.map((c) => [`${c.nombre || '-'} ${c.apellido || ''}`, `${c.tipo_doc || 'DNI'} ${c.documento || '-'}`, c.telefono || '-', c.email || '-', c.direccion || '-', <RowActions onEdit={() => openEdit(c)} onDelete={() => remove(c)} />])}
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
              <Field label="Documento" value={form.documento} onChange={(v) => setForm({ ...form, documento: v })} />
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

function Cuentas({ supabase, user }) {
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferencias, setTransferencias] = React.useState([]);
  const emptyForm = { banco: '', tipo: 'Ahorros', numero: '', cci: '', moneda: 'PEN', saldo: '' };
  const emptyTransfer = { tipo_destino: 'propia', cuenta_origen_id: '', cuenta_destino_id: '', banco_destino: '', numero_destino: '', titular_destino: '', monto: '', fecha: today(), notas: '' };
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [transferForm, setTransferForm] = React.useState(emptyTransfer);
  const load = React.useCallback(async () => {
    const [{ data: cuentasData }, { data: transferenciasData }] = await Promise.all([
      supabase.from('cuentas').select('*').eq('admin_id', user.id).order('created_at', { ascending: false }),
      supabase.from('transferencias').select('*').eq('admin_id', user.id).order('fecha', { ascending: false }).limit(10),
    ]);
    setCuentas(cuentasData || []);
    setTransferencias(transferenciasData || []);
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
    if (!(await confirmAction(`Eliminar cuenta ${cuenta.banco || ''}?`))) return;
    const { error } = await supabase.from('cuentas').delete().eq('id', cuenta.id).eq('admin_id', user.id);
    if (error) {
      notify(error.message);
      return;
    }
    load();
  }
  async function save(event) {
    event.preventDefault();
    const payload = { ...form, saldo: Number(form.saldo || 0) };
    const { error } = editingId
      ? await supabase.from('cuentas').update(payload).eq('id', editingId).eq('admin_id', user.id)
      : await supabase.from('cuentas').insert({ ...payload, admin_id: user.id });
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
    const { error } = await supabase.rpc('registrar_transferencia', payload);
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
      <div className="action-bar"><div></div><div className="table-actions"><button className="btn" onClick={() => setTransferOpen(true)}><ArrowRightLeft size={16} />Nueva transferencia</button><button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva cuenta</button></div></div>
      <div className="grid-3">{cuentas.map((c) => <div className="account-card account-card-hover" key={c.id}><div className="account-card-actions"><RowActions onEdit={() => openEdit(c)} onDelete={() => remove(c)} /></div><Building2 /><strong>{c.banco}</strong><span>{c.tipo} - {c.moneda}</span><b>{money(c.saldo)}</b></div>)}</div>
      <div className="card transfer-card"><div className="card-header"><h3>Ultimas transferencias</h3></div><div className="card-body">{transferencias.length ? transferencias.map((t) => <div className="list-row transfer-row" key={t.id}><span>{dateFmt(t.fecha)} - {cuentaNombre(t.cuenta_origen_id)} a {t.tipo_destino === 'propia' ? cuentaNombre(t.cuenta_destino_id) : `${t.banco_destino || 'Cuenta externa'} ${t.numero_destino || ''}`}</span><strong>{money(t.monto)}</strong></div>) : <div className="empty-state"><p>Sin transferencias registradas</p></div>}</div></div>
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

function Deudas({ supabase, user, isAdmin }) {
  const [deudas, setDeudas] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({ cliente_id: '', descripcion: '', monto_total: '', interes: '0', tipo: 'Préstamo', fecha_inicio: today(), fecha_vencimiento: '', notas: '' });
  const load = React.useCallback(() => {
    const q = supabase.from('deudas').select('*,clientes(nombre,apellido,user_id)').order('fecha_vencimiento');
    q.eq('admin_id', user.id).then(({ data }) => setDeudas((data || []).map((d) => ({ ...d, estado: calcEstado(d) }))));
  }, [supabase, user.id]);
  React.useEffect(() => {
    load();
    supabase.from('clientes').select('*').eq('admin_id', user.id).order('nombre').then(({ data }) => setClientes(data || []));
  }, [load, supabase, user.id]);
  function openCreate() {
    setEditingId(null);
    setForm({ cliente_id: '', descripcion: '', monto_total: '', interes: '0', tipo: 'Préstamo', fecha_inicio: today(), fecha_vencimiento: '', notas: '' });
    setOpen(true);
  }
  function openEdit(deuda) {
    setEditingId(deuda.id);
    setForm({
      cliente_id: deuda.cliente_id || '',
      descripcion: deuda.descripcion || '',
      monto_total: deuda.monto_total ?? '',
      interes: deuda.interes ?? '0',
      tipo: deuda.tipo || 'Préstamo',
      fecha_inicio: deuda.fecha_inicio || today(),
      fecha_vencimiento: deuda.fecha_vencimiento || '',
      notas: deuda.notas || '',
    });
    setOpen(true);
  }
  async function remove(deuda) {
    if (!(await confirmAction(`Eliminar deuda ${deuda.descripcion || ''}?`))) return;
    const { error } = await supabase.from('deudas').delete().eq('id', deuda.id).eq('admin_id', user.id);
    if (error) {
      notify(error.message);
      return;
    }
    load();
  }
  async function save(event) {
    event.preventDefault();
    const payload = {
      admin_id: user.id,
      cliente_id: form.cliente_id,
      descripcion: form.descripcion,
      monto_total: Number(form.monto_total || 0),
      interes: Number(form.interes || 0),
      tipo: form.tipo,
      fecha_inicio: form.fecha_inicio || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      notas: form.notas,
    };
    if (!payload.cliente_id || !payload.descripcion || !payload.monto_total) return;
    const { error } = editingId
      ? await supabase.from('deudas').update(payload).eq('id', editingId).eq('admin_id', user.id)
      : await supabase.from('deudas').insert(payload);
    if (error) {
      notify(error.message);
      return;
    }
    setForm({ cliente_id: '', descripcion: '', monto_total: '', interes: '0', tipo: 'Préstamo', fecha_inicio: today(), fecha_vencimiento: '', notas: '' });
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Deudas"
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva deuda</button>}
        columns={['Cliente', 'Descripción', 'Total', 'Pendiente', 'Vencimiento', 'Estado']}
        rows={deudas.map((d) => [`${d.clientes?.nombre || ''} ${d.clientes?.apellido || ''}`, d.descripcion, money(d.monto_total), money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0)), dateFmt(d.fecha_vencimiento), badge(d.estado), <RowActions onEdit={() => openEdit(d)} onDelete={() => remove(d)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar deuda' : 'Nueva deuda'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <SelectField label="Cliente" value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v })}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellido || ''}</option>)}
            </SelectField>
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} required />
            <div className="form-row">
              <Field label="Monto total" type="number" value={form.monto_total} onChange={(v) => setForm({ ...form, monto_total: v })} required />
              <Field label="Interés (%)" type="number" value={form.interes} onChange={(v) => setForm({ ...form, interes: v })} />
            </div>
            <div className="form-row">
              <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })}><option>Préstamo</option><option>Venta</option><option>Servicio</option><option>Otro</option></SelectField>
              <Field label="Vencimiento" type="date" value={form.fecha_vencimiento} onChange={(v) => setForm({ ...form, fecha_vencimiento: v })} />
            </div>
            <Field label="Fecha inicio" type="date" value={form.fecha_inicio} onChange={(v) => setForm({ ...form, fecha_inicio: v })} />
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
    </>
  );
}

function Pagos({ supabase, user, isAdmin }) {
  const [pagos, setPagos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [deudas, setDeudas] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({ cliente_id: '', deuda_id: '', cuenta_id: '', monto: '', metodo: 'Efectivo', referencia: '', fecha: today(), notas: '' });
  const load = React.useCallback(() => {
    const q = supabase.from('pagos').select('*,clientes(nombre,apellido,user_id),deudas(descripcion),cuentas(banco)').order('fecha', { ascending: false });
    q.eq('admin_id', user.id).then(({ data }) => setPagos(data || []));
  }, [supabase, user.id]);
  React.useEffect(() => {
    load();
    supabase.from('clientes').select('*').eq('admin_id', user.id).order('nombre').then(({ data }) => setClientes(data || []));
    supabase.from('deudas').select('*,clientes(nombre,apellido,user_id)').eq('admin_id', user.id).then(({ data }) => setDeudas((data || []).map((d) => ({ ...d, estado: calcEstado(d) }))));
    supabase.from('cuentas').select('*').eq('admin_id', user.id).then(({ data }) => setCuentas(data || []));
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
    if (!(await confirmAction('Eliminar este pago? Se revertira la deuda y el saldo de la cuenta.'))) return;
    const { error } = await supabase.rpc('eliminar_pago', { p_pago_id: pago.id });
    if (error) {
      notify(error.message);
      return;
    }
    refreshRelated();
  }
  function refreshRelated() {
    load();
    supabase.from('deudas').select('*,clientes(nombre,apellido,user_id)').eq('admin_id', user.id).then(({ data }) => setDeudas((data || []).map((d) => ({ ...d, estado: calcEstado(d) }))));
    supabase.from('cuentas').select('*').eq('admin_id', user.id).then(({ data }) => setCuentas(data || []));
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
      ? await supabase.rpc('actualizar_pago', { p_pago_id: editingId, ...payload })
      : await supabase.rpc('registrar_pago', payload);
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
        title="Pagos"
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Registrar pago</button>}
        columns={['Fecha', 'Cliente', 'Deuda', 'Monto', 'Método', 'Cuenta']}
        rows={pagos.map((p) => [dateFmt(p.fecha), `${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, p.deudas?.descripcion || '-', money(p.monto), p.metodo, p.cuentas?.banco || '-', <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar pago' : 'Registrar pago'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <SelectField label="Cliente" value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v, deuda_id: '' })}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellido || ''}</option>)}
            </SelectField>
            <SelectField label="Deuda" value={form.deuda_id} onChange={(v) => setForm({ ...form, deuda_id: v })}>
              <option value="">Seleccionar deuda...</option>
              {deudasCliente.map((d) => <option key={d.id} value={d.id}>{d.descripcion} - pendiente {money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0))}</option>)}
            </SelectField>
            <div className="form-row">
              <Field label="Monto pagado" type="number" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} required />
              <Field label="Fecha de pago" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} required />
            </div>
            <div className="form-row">
              <SelectField label="Método" value={form.metodo} onChange={(v) => setForm({ ...form, metodo: v })}><option>Efectivo</option><option>Transferencia</option><option>Yape</option><option>Plin</option><option>Depósito</option></SelectField>
              <SelectField label="Cuenta destino" value={form.cuenta_id} onChange={(v) => setForm({ ...form, cuenta_id: v })}><option value="">Sin cuenta</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo}</option>)}</SelectField>
            </div>
            <Field label="Referencia" value={form.referencia} onChange={(v) => setForm({ ...form, referencia: v })} />
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />{editingId ? 'Actualizar pago' : 'Registrar pago'}</button></div>
        </form>
      </Modal>
    </>
  );
}

function Movimientos({ supabase, user, isAdmin }) {
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
    const q = supabase.from('movimientos').select('*,tipos_movimiento(nombre),cuentas(banco,tipo)').order('fecha', { ascending: false });
    const { data } = await q.eq('admin_id', user.id);
    setMovimientos(data || []);
    const { data: tiposData } = await supabase.from('tipos_movimiento').select('*').eq('admin_id', user.id).order('tipo').order('nombre');
    setTipos(tiposData || []);
    const { data: cuentasData } = await supabase.from('cuentas').select('*').eq('admin_id', user.id).order('banco');
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
    if (!(await confirmAction(`Eliminar movimiento ${movimiento.concepto || ''}?`))) return;
    const { error } = await supabase.rpc('eliminar_movimiento_financiero', { p_movimiento_id: movimiento.id });
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
      ? await supabase.rpc('actualizar_movimiento_financiero', { p_movimiento_id: editingId, ...payload })
      : await supabase.rpc('registrar_movimiento_financiero', payload);
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
    if (!tipoForm.nombre) return;
    const { error } = tipoEditingId
      ? await supabase.from('tipos_movimiento').update(tipoForm).eq('id', tipoEditingId).eq('admin_id', user.id)
      : await supabase.from('tipos_movimiento').insert({ ...tipoForm, admin_id: user.id });
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
    if (!(await confirmAction(`Eliminar tipo ${tipo.nombre || ''}?`))) return;
    const { error } = await supabase.from('tipos_movimiento').delete().eq('id', tipo.id).eq('admin_id', user.id);
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
        action={<div className="table-actions"><button className="btn" onClick={() => setTiposOpen(true)}><Settings size={16} />Tipos</button><button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo movimiento</button></div>}
        columns={['Fecha', 'Tipo', 'Concepto', 'Tipo de movimiento', 'Cuenta', 'Monto']}
        rows={movimientos.map((m) => [dateFmt(m.fecha), badge(m.tipo), m.concepto, m.tipos_movimiento?.nombre || m.categoria || '-', m.cuentas ? `${m.cuentas.banco} - ${m.cuentas.tipo || ''}` : '-', money(m.monto), <RowActions onEdit={() => openEdit(m)} onDelete={() => remove(m)} />])}
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
              {tipos.map((t) => <div key={t.id} className="list-row type-row"><span>{badge(t.tipo)} {t.nombre}</span><RowActions onEdit={() => editTipo(t)} onDelete={() => removeTipo(t)} /></div>)}
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setTiposOpen(false)}>Cerrar</button><button className="btn btn-primary">{tipoEditingId ? <Check size={16} /> : <Plus size={16} />}{tipoEditingId ? 'Actualizar' : 'Agregar'}</button></div>
        </form>
      </Modal>
    </>
  );
}

function Reportes({ supabase, user }) {
  const [rows, setRows] = React.useState([]);
  React.useEffect(() => {
    supabase.from('deudas').select('*,clientes(nombre,apellido)').eq('admin_id', user.id).then(({ data }) => setRows(data || []));
  }, [supabase, user.id]);
  const summary = rows.reduce((map, d) => {
    const name = `${d.clientes?.nombre || ''} ${d.clientes?.apellido || ''}`;
    map[name] ||= { total: 0, pagado: 0 };
    map[name].total += Number(d.monto_total || 0);
    map[name].pagado += Number(d.monto_pagado || 0);
    return map;
  }, {});
  const tableRows = Object.entries(summary).map(([name, r]) => [name, money(r.total), money(r.pagado), money(r.total - r.pagado), r.total - r.pagado <= 0 ? badge('pagado') : badge('vencido')]);
  return <TableSection title="Resumen por cliente" columns={['Cliente', 'Deuda total', 'Pagado', 'Pendiente', 'Estado']} rows={tableRows} />;
}

function Perfil({ supabase, user, profile, onSaved }) {
  const [form, setForm] = React.useState({ nombre: '', apellido: '', tipo_doc: 'DNI', documento: '', email_contacto: '', telefono: '', direccion: '', empresa: '', moneda: 'PEN' });
  const [status, setStatus] = React.useState('');
  React.useEffect(() => setForm({
    nombre: profile?.nombre || '',
    apellido: profile?.apellido || '',
    tipo_doc: profile?.tipo_doc || 'DNI',
    documento: profile?.documento || '',
    email_contacto: profile?.email_contacto || user.email || '',
    telefono: profile?.telefono || '',
    direccion: profile?.direccion || '',
    empresa: profile?.empresa || '',
    moneda: profile?.moneda || 'PEN',
  }), [profile, user.email]);
  async function save(event) {
    event.preventDefault();
    setStatus('');
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus('Perfil actualizado correctamente.');
    onSaved();
  }
  return <div className="profile-section"><div className="card"><div className="card-header"><h3>Información personal</h3></div><form className="card-body" onSubmit={save}>
    <div className="avatar-upload"><div className="avatar-big">{initials(profile, user.email)}</div><div><div className="profile-name">{fullName(profile) || user.email}</div><div className="muted">{user.email}</div><div className="role-text">{profile?.role === 'admin' ? 'Administrador' : 'Usuario'}</div></div></div>
    <div className="form-row"><Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} /><Field label="Apellido" value={form.apellido} onChange={(v) => setForm({ ...form, apellido: v })} /></div>
    <div className="form-row">
      <SelectField label="Tipo de documento" value={form.tipo_doc} onChange={(v) => setForm({ ...form, tipo_doc: v })}><option>DNI</option><option>RUC</option><option>CE</option><option>Pasaporte</option></SelectField>
      <Field label="Documento" value={form.documento} onChange={(v) => setForm({ ...form, documento: v })} />
    </div>
    <Field label="Email de contacto" type="email" value={form.email_contacto} onChange={(v) => setForm({ ...form, email_contacto: v })} />
    <Field label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
    <Field label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
    <Field label="Empresa / Negocio" value={form.empresa} onChange={(v) => setForm({ ...form, empresa: v })} />
    <SelectField label="Moneda predeterminada" value={form.moneda} onChange={(v) => setForm({ ...form, moneda: v })}><option value="PEN">Soles (S/)</option><option value="USD">Dólares ($)</option><option value="EUR">Euros (€)</option></SelectField>
    {status && <div className={`connection-status ${status.includes('correctamente') ? 'success' : ''}`}>{status}</div>}
    <button className="btn btn-primary"><Check size={16} />Guardar cambios</button>
  </form></div></div>;
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay open" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose} type="button">X</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="row-actions">
      <button type="button" className="btn btn-sm btn-icon" onClick={onEdit} title="Editar"><Pencil size={14} /></button>
      <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={onDelete} title="Eliminar"><Trash2 size={14} /></button>
    </div>
  );
}

function TableSection({ title, columns, rows, search, setSearch, action }) {
  const columnCount = Math.max(columns.length, ...rows.map((row) => row.length), 0);
  const visibleColumns = [...columns, ...Array.from({ length: columnCount - columns.length }, () => 'Acciones')];
  return (
    <>
      {(setSearch || action) && <div className="action-bar"><div>{setSearch && <div className="search-wrap"><Search size={16} /><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${title.toLowerCase()}...`} /></div>}</div>{action}</div>}
      <div className="card"><div className="card-header"><h3>{title}</h3>{title === 'Resumen por cliente' && <button className="btn btn-sm"><Download size={14} />Exportar CSV</button>}</div><div className="table-wrap"><table><thead><tr>{visibleColumns.map((c, i) => <th key={`${c}-${i}`}>{c}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={columnCount || columns.length}><div className="empty-state"><p>Sin datos</p></div></td></tr>}</tbody></table></div></div>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

