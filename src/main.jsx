import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  Banknote,
  Building2,
  CalendarClock,
  Check,
  ClipboardList,
  CreditCard,
  Database,
  DollarSign,
  Eye,
  EyeOff,
  FileDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  ShieldCheck,
  Settings,
  ArrowRightLeft,
  Target,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react';
import { createStoredClient, createSupabaseClient } from './config/supabase';
import { LOCKED_KEY, REMEMBER_EMAIL_KEY, REMEMBER_KEY } from './constants/authStorage';
import { clearRememberedAccount, signInWithPassword, signUpUser } from './controllers/auth.controller';
import { updateMobilePin, updateProfile } from './controllers/profile.controller';
import { AppDialogs, AuthCard, Field, Modal, RowActions, SelectField, TableSection } from './components/ui';
import { clearFeedbackHandlers, confirmAction, hideBusy, notify, setFeedbackHandlers, showBusy } from './services/feedback';
import { calcEstado, dateFmt, money, month, today } from './utils/format';
import { hashPin, isMobileViewport } from './utils/security';
import './styles.css';

const LAST_PAGE_KEY = 'fintrack_last_page';
const PAGE_IDS = [
  'dashboard',
  'clientes',
  'cuentas',
  'deudas',
  'prestamos',
  'cobros-prestamos',
  'prestamos-recibidos',
  'pagos-prestamos-recibidos',
  'pagos',
  'movimientos',
  'presupuestos',
  'metas',
  'reportes',
  'backup',
  'auditoria',
  'perfil',
  'usuarios-admin',
  'config',
];

function App() {
  const [supabase, setSupabase] = React.useState(createStoredClient);
  const [session, setSession] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [page, setPage] = React.useState(() => {
    const savedPage = localStorage.getItem(LAST_PAGE_KEY);
    return PAGE_IDS.includes(savedPage) ? savedPage : 'dashboard';
  });
  const [message, setMessage] = React.useState('');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [toast, setToast] = React.useState(null);
  const [confirmState, setConfirmState] = React.useState(null);
  const [busy, setBusy] = React.useState({ active: false, message: '' });
  const [installPrompt, setInstallPrompt] = React.useState(null);
  const [locked, setLocked] = React.useState(() => localStorage.getItem(LOCKED_KEY) === '1');
  const [sidebarHidden, setSidebarHidden] = React.useState(() => localStorage.getItem('fintrack_sidebar_hidden') === '1');

  React.useEffect(() => {
    setFeedbackHandlers({
      onNotify: ({ message: nextMessage, type }) => {
        setToast({ message: nextMessage, type });
        window.clearTimeout(window.__fintrackToastTimer);
        window.__fintrackToastTimer = window.setTimeout(() => setToast(null), 4500);
      },
      onConfirm: (question) => new Promise((resolve) => setConfirmState({ question, resolve })),
      onBusy: setBusy,
    });
    return clearFeedbackHandlers;
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
      if (data && (data.activo === false || data.deleted_at)) {
        setMessage('Tu usuario está desactivado. Contacta al administrador.');
        clearRememberedAccount();
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return;
      }
      setProfile(data || {});
    }
    loadProfile();
  }, [supabase, session, refreshKey]);

  React.useEffect(() => {
    if (locked && profile && !profile.pin_hash) {
      localStorage.removeItem(LOCKED_KEY);
      setLocked(false);
    }
  }, [locked, profile]);

  React.useEffect(() => {
    if (!profile) return;
    const isAdminProfile = profile?.role === 'admin';
    const adminOnly = ['config', 'usuarios-admin'];
    if (!PAGE_IDS.includes(page) || (adminOnly.includes(page) && !isAdminProfile)) {
      setPage('dashboard');
      localStorage.setItem(LAST_PAGE_KEY, 'dashboard');
      return;
    }
    localStorage.setItem(LAST_PAGE_KEY, page);
  }, [page, profile]);

  if (!supabase) return <><Setup onReady={setSupabase} /><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  if (!session) return <><Auth supabase={supabase} message={message} setMessage={setMessage} /><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  if (locked && !profile) return <><AuthCard title="Desbloquear FinTrack"><p className="muted">Cargando cuenta recordada...</p></AuthCard><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  if (locked && profile?.pin_hash) {
    return <><PinUnlock supabase={supabase} profile={profile} onUnlock={() => {
      localStorage.removeItem(LOCKED_KEY);
      setLocked(false);
    }} onFullLogout={async () => {
      clearRememberedAccount();
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setLocked(false);
    }} /><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  }

  const isAdmin = profile?.role === 'admin';
  const pages = [
    ['principal', [
      ['dashboard', 'Dashboard', LayoutDashboard, true],
      ['clientes', 'Clientes', Users, true],
    ]],
    ['finanzas', [
      ['cuentas', 'Cuentas bancarias', Building2, true],
      ['deudas', 'Pendientes por cobrar', CreditCard, true],
      ['prestamos', 'Préstamos otorgados', TrendingDown, true],
      ['cobros-prestamos', 'Cobros de préstamos', TrendingUp, true],
      ['prestamos-recibidos', 'Préstamos recibidos', Banknote, true],
      ['pagos-prestamos-recibidos', 'Pagos de préstamos', TrendingDown, true],
      ['pagos', 'Cobros generales', Banknote, true],
      ['movimientos', 'Ingresos / Egresos', Wallet, true],
      ['presupuestos', 'Presupuestos', ClipboardList, true],
      ['metas', 'Metas', Target, true],
    ]],
    ['análisis', [
      ['reportes', 'Reportes', BarChart3, true],
      ['backup', 'Backup', Database, true],
      ['auditoria', 'Auditoría', ShieldCheck, true],
    ]],
    ['sistema', [
      ['perfil', 'Mi perfil', UserCircle, true],
      ['usuarios-admin', 'Usuarios', Users, isAdmin],
      ['config', 'Configuración', Settings, isAdmin],
    ]],
  ];

  async function logout() {
    const canLock = isMobileViewport() && localStorage.getItem(REMEMBER_KEY) === '1' && profile?.pin_hash;
    if (canLock) {
      localStorage.setItem(LOCKED_KEY, '1');
      setLocked(true);
      return;
    }
    await supabase.auth.signOut();
    localStorage.removeItem(LOCKED_KEY);
    setSession(null);
    setProfile(null);
  }

  function openPage(nextPage) {
    if ((nextPage === 'config' || nextPage === 'usuarios-admin') && !isAdmin) return;
    setPage(nextPage);
  }

  function toggleSidebar() {
    setSidebarHidden((current) => {
      const next = !current;
      localStorage.setItem('fintrack_sidebar_hidden', next ? '1' : '0');
      return next;
    });
  }

  return (
    <div className={`layout ${sidebarHidden ? 'sidebar-hidden' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="brand">
            <div className="brand-icon"><AppLogoIcon /></div>
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
            <button className="btn btn-icon sidebar-toggle" type="button" onClick={toggleSidebar} title={sidebarHidden ? 'Mostrar menú' : 'Ocultar menú'}><Menu size={18} /></button>
            <div>
              <h2>{pageTitle(page, isAdmin)[0]}</h2>
              <p>{pageTitle(page, isAdmin)[1]}</p>
            </div>
          </div>
          <div className="topbar-actions">
            {installPrompt && <button className="btn btn-primary" onClick={async () => {
              await installPrompt.prompt();
              setInstallPrompt(null);
            }}>Instalar app</button>}
            <button className="btn mobile-logout-btn" onClick={logout}>
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
        {message && <div className="alert alert-danger">{message}</div>}
        <div className={`page active page-${page}`}>
          {page === 'dashboard' && <Dashboard supabase={supabase} user={session.user} isAdmin={isAdmin} />}
          {page === 'clientes' && <Clientes supabase={supabase} user={session.user} />}
          {page === 'cuentas' && <Cuentas supabase={supabase} user={session.user} />}
          {page === 'deudas' && <Deudas supabase={supabase} user={session.user} isAdmin={isAdmin} />}
          {page === 'prestamos' && <Prestamos supabase={supabase} user={session.user} />}
          {page === 'cobros-prestamos' && <CobrosPrestamos supabase={supabase} user={session.user} />}
          {page === 'prestamos-recibidos' && <PrestamosRecibidos supabase={supabase} user={session.user} />}
          {page === 'pagos-prestamos-recibidos' && <PagosPrestamosRecibidos supabase={supabase} user={session.user} />}
          {page === 'pagos' && <Pagos supabase={supabase} user={session.user} isAdmin={isAdmin} />}
          {page === 'movimientos' && <Movimientos supabase={supabase} user={session.user} isAdmin={isAdmin} />}
          {page === 'presupuestos' && <Presupuestos supabase={supabase} user={session.user} />}
          {page === 'metas' && <Metas supabase={supabase} user={session.user} />}
          {page === 'reportes' && <Reportes supabase={supabase} user={session.user} />}
          {page === 'backup' && <Backup supabase={supabase} user={session.user} />}
          {page === 'auditoria' && <Auditoria supabase={supabase} user={session.user} />}
          {page === 'perfil' && <Perfil supabase={supabase} user={session.user} profile={profile} onSaved={() => setRefreshKey((x) => x + 1)} />}
          {page === 'usuarios-admin' && isAdmin && <UsuariosAdmin supabase={supabase} user={session.user} />}
          {page === 'config' && isAdmin && <Config onReady={setSupabase} />}
        </div>
      </main>
      <AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} />
    </div>
  );
}

function initials(profile, email) {
  return ((profile?.nombre?.[0] || '') + (profile?.apellido?.[0] || '')).toUpperCase() || email?.[0]?.toUpperCase() || '?';
}
function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
}
function downloadText(filename, content, type = 'application/json') {
  showBusy('Descargando...');
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  window.setTimeout(() => hideBusy(), 350);
}
function toCsv(rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n');
}
async function logAudit(supabase, userId, tabla, accion, descripcion, registro_id = null, datos = null) {
  await supabase.from('auditoria').insert({ admin_id: userId, tabla, accion, descripcion, registro_id, datos });
}
function pageTitle(page, isAdmin) {
  const labels = {
    dashboard: ['Dashboard', 'Resumen general de finanzas'],
    clientes: ['Clientes', 'Personas registradas por el administrador'],
    cuentas: ['Cuentas bancarias', 'Administra tus cuentas y billeteras'],
    deudas: ['Pendientes por cobrar', 'Deudas que tus clientes tienen contigo'],
    prestamos: ['Préstamos otorgados', 'Dinero que prestas a clientes'],
    'cobros-prestamos': ['Cobros de préstamos otorgados', 'Pagos recibidos por préstamos que diste'],
    'prestamos-recibidos': ['Préstamos recibidos', 'Dinero que te prestaron a ti'],
    'pagos-prestamos-recibidos': ['Pagos de préstamos recibidos', 'Cuotas que pagas a tus acreedores'],
    pagos: ['Cobros generales', 'Pagos recibidos por ventas, servicios o pendientes'],
    movimientos: ['Ingresos y egresos', 'Movimientos generales de caja'],
    presupuestos: ['Presupuestos', 'Control mensual por categoría'],
    metas: ['Metas financieras', 'Objetivos de ahorro y crecimiento'],
    reportes: ['Reportes', 'Análisis financiero'],
    backup: ['Backup', 'Exportación de datos'],
    auditoria: ['Auditoría', 'Historial de acciones importantes'],
    perfil: ['Mi perfil', 'Información personal y seguridad'],
    'usuarios-admin': ['Usuarios', 'Activación y control de accesos'],
    config: ['Configuración', 'Conexión a base de datos'],
  };
  return labels[page] || ['FinTrack', ''];
}
function badge(estado) {
  const map = {
    al_dia: ['badge-green', 'Al día'],
    por_vencer: ['badge-yellow', 'Por vencer'],
    vencido: ['badge-red', 'Vencido'],
    pagado: ['badge-blue', 'Pagado'],
    ingreso: ['badge-green', 'Ingreso'],
    egreso: ['badge-red', 'Egreso'],
    activa: ['badge-green', 'Activa'],
    completada: ['badge-blue', 'Completada'],
    pausada: ['badge-yellow', 'Pausada'],
  };
  const [className, text] = map[estado] || ['badge-gray', estado];
  return <span className={`badge ${className}`}>{text}</span>;
}

function AppLogoIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M14 23.5h36a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6v-16a6 6 0 0 1 6-6Z" stroke="currentColor" strokeWidth="5" />
      <path d="M16 23.5 40 12h5a5 5 0 0 1 5 5v6.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M42 36h14v10H42a5 5 0 0 1 0-10Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <path d="M20 36h12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="45" cy="41" r="2.8" fill="currentColor" />
    </svg>
  );
}

function Setup({ onReady }) {
  return <AuthCard title="Conectar Supabase"><Config onReady={onReady} compact /></AuthCard>;
}

function Auth({ supabase, message, setMessage }) {
  const [mode, setMode] = React.useState('login');
  const [form, setForm] = React.useState({ nombre: '', apellido: '', email: localStorage.getItem(REMEMBER_EMAIL_KEY) || '', password: '' });
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(localStorage.getItem(REMEMBER_KEY) === '1');
  const [loading, setLoading] = React.useState(false);
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signInWithPassword({
          supabase,
          email: form.email,
          password: form.password,
          remember,
        });
        if (error) setMessage(error.message);
        return;
      }
      const { error } = await signUpUser({
        supabase,
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        apellido: form.apellido,
      });
      if (error) {
        const rateLimited = error.status === 429 || /rate limit|email rate/i.test(error.message);
        setMessage(rateLimited ? 'Supabase alcanzó el límite temporal de correos. Espera o configura SMTP propio.' : error.message);
      } else {
        setMessage('Correo de confirmación enviado. Revisa bandeja de entrada y spam.');
      }
    } catch (error) {
      setMessage(error.message || 'No se pudo iniciar sesión. Revisa tu conexión.');
    } finally {
      setLoading(false);
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
        {mode === 'login' && (
          <label className="check-row">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Recordar cuenta y usar PIN en este celular</span>
          </label>
        )}
        <button className="btn-full" disabled={loading}>{loading ? (mode === 'login' ? 'Ingresando...' : 'Creando cuenta...') : (mode === 'login' ? 'Entrar al sistema' : 'Crear cuenta de cliente')}</button>
        {message && <div className="auth-error">{message}</div>}
      </form>
    </AuthCard>
  );
}

function PinUnlock({ profile, onUnlock, onFullLogout }) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(pin)) {
      setError('Ingresa tu PIN de 6 dígitos.');
      return;
    }
    const nextHash = await hashPin(pin, profile.pin_salt);
    if (nextHash !== profile.pin_hash) {
      setError('PIN incorrecto.');
      setPin('');
      return;
    }
    onUnlock();
  }

  return (
    <AuthCard title="Desbloquear FinTrack">
      <form onSubmit={submit}>
        <div className="pin-user">
          <div className="user-avatar">{initials(profile, profile?.email_contacto)}</div>
          <div>
            <strong>{fullName(profile) || 'Cuenta recordada'}</strong>
            <span>Ingresa tu PIN para continuar</span>
          </div>
        </div>
        <Field
          label="PIN de 6 dígitos"
          type="password"
          value={pin}
          onChange={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
          required
          minLength={6}
          inputMode="numeric"
          pattern="\d{6}"
          placeholder="------"
        />
        <button className="btn-full">Entrar con PIN</button>
        {error && <div className="auth-error">{error}</div>}
        <button type="button" className="link-button" onClick={onFullLogout}>Cerrar sesión completa</button>
      </form>
    </AuthCard>
  );
}

function Config({ onReady, compact = false }) {
  const [url, setUrl] = React.useState(localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || '');
  const [key, setKey] = React.useState(localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function save(event) {
    event.preventDefault();
    setLoading(true);
    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) {
      setStatus('La URL debe tener formato https://proyecto.supabase.co');
      setLoading(false);
      return;
    }
    const client = createSupabaseClient(cleanUrl, key.trim());
    const { error } = await client.from('profiles').select('id').limit(1);
    if (error && !/profiles|schema cache|relation/i.test(error.message) && error.code !== '42501') {
      setStatus(error.message);
      setLoading(false);
      return;
    }
    localStorage.setItem('sb_url', cleanUrl);
    localStorage.setItem('sb_key', key.trim());
    setStatus('Conexión guardada correctamente.');
    onReady(client);
    setLoading(false);
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
            <button className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar conexión'}</button>
            {status && <div className="connection-status success">{status}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}

const DASHBOARD_CARDS_KEY = 'fintrack_dashboard_cards';
const DASHBOARD_CARD_OPTIONS = [
  { id: 'balance', label: 'Balance de cuentas' },
  { id: 'pendiente', label: 'Pendiente por cobrar' },
  { id: 'pagos', label: 'Cobros del mes' },
  { id: 'movimientos', label: 'Ingresos / Egresos' },
];
const DEFAULT_DASHBOARD_CARDS = DASHBOARD_CARD_OPTIONS.map((item) => item.id);

function Dashboard({ supabase, user, isAdmin }) {
  const [data, setData] = React.useState({ deudas: [], pagos: [], cuentas: [], movimientos: [], presupuestos: [], metas: [] });
  const [configOpen, setConfigOpen] = React.useState(false);
  const [draftCards, setDraftCards] = React.useState(DEFAULT_DASHBOARD_CARDS);
  const [visibleCards, setVisibleCards] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DASHBOARD_CARDS_KEY) || 'null');
      return Array.isArray(saved) && saved.length ? saved : DEFAULT_DASHBOARD_CARDS;
    } catch {
      return DEFAULT_DASHBOARD_CARDS;
    }
  });
  React.useEffect(() => {
    async function load() {
      const deudasQ = supabase.from('deudas').select('*,clientes(nombre,apellido)');
      const pagosQ = supabase.from('pagos').select('*,clientes(nombre,apellido),deudas(descripcion)').order('fecha', { ascending: false }).limit(30);
      const movQ = supabase.from('movimientos').select('*');
      const cuentasQ = supabase.from('cuentas').select('*').eq('admin_id', user.id);
      const presupuestosQ = supabase.from('presupuestos').select('*,tipos_movimiento(nombre)').eq('admin_id', user.id).eq('mes', month());
      const metasQ = supabase.from('metas').select('*').eq('admin_id', user.id).order('fecha_objetivo', { ascending: true });
      const [deudas, pagos, cuentas, movimientos, presupuestos, metas] = await Promise.all([
        deudasQ.eq('admin_id', user.id),
        pagosQ.eq('admin_id', user.id),
        cuentasQ,
        movQ.eq('admin_id', user.id),
        presupuestosQ,
        metasQ,
      ]);
      setData({ deudas: deudas.data || [], pagos: pagos.data || [], cuentas: cuentas.data || [], movimientos: movimientos.data || [], presupuestos: presupuestos.data || [], metas: metas.data || [] });
    }
    load();
  }, [supabase, user.id, isAdmin]);
  React.useEffect(() => {
    localStorage.setItem(DASHBOARD_CARDS_KEY, JSON.stringify(visibleCards));
  }, [visibleCards]);
  const isVisible = (id) => visibleCards.includes(id);
  function openDashboardConfig() {
    setDraftCards(visibleCards);
    setConfigOpen(true);
  }
  function closeDashboardConfig() {
    setConfigOpen(false);
    setDraftCards(visibleCards);
  }
  function saveDashboardConfig() {
    setVisibleCards(draftCards);
    setConfigOpen(false);
  }
  function toggleDraftCard(id) {
    setDraftCards((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  const pendiente = data.deudas.reduce((sum, d) => sum + Math.max(0, Number(d.monto_total || 0) - Number(d.monto_pagado || 0)), 0);
  const ingresos = data.movimientos.filter((m) => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto || 0), 0);
  const egresos = data.movimientos.filter((m) => m.tipo === 'egreso').reduce((sum, m) => sum + Number(m.monto || 0), 0);
  const pagosMes = data.pagos.filter((p) => p.fecha?.startsWith(month())).reduce((sum, p) => sum + Number(p.monto || 0), 0);
  const porVencer = data.deudas.filter((d) => ['por_vencer', 'vencido'].includes(calcEstado(d))).slice(0, 5);
  const movimientosMes = data.movimientos.filter((m) => m.fecha?.startsWith(month()));
  const balanceTotal = data.cuentas.reduce((s, c) => s + Number(c.saldo || 0), 0);
  const cobradoDeudas = data.deudas.reduce((sum, d) => sum + Number(d.monto_pagado || 0), 0);
  const pagosPorDia = data.pagos
    .filter((p) => p.fecha?.startsWith(month()))
    .reduce((map, p) => {
      const day = p.fecha.slice(-2);
      map[day] = (map[day] || 0) + Number(p.monto || 0);
      return map;
    }, {});
  const accountChart = data.cuentas.map((c) => ({ label: c.banco, value: Number(c.saldo || 0) }));
  const debtChart = [
    { label: 'Cobrado', value: cobradoDeudas },
    { label: 'Pendiente', value: pendiente },
  ];
  const paymentsChart = Object.entries(pagosPorDia).slice(-8).map(([label, value]) => ({ label, value }));
  const movementChart = [
    { label: 'Ingresos', value: ingresos },
    { label: 'Egresos', value: egresos },
  ];
  const presupuestoAlerts = data.presupuestos
    .map((p) => {
      const usado = movimientosMes
        .filter((m) => m.tipo === p.tipo && ((p.tipo_movimiento_id && m.tipo_movimiento_id === p.tipo_movimiento_id) || (!p.tipo_movimiento_id && (m.categoria || '') === (p.categoria || ''))))
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);
      const limite = Number(p.monto_limite || 0);
      return { label: p.tipos_movimiento?.nombre || p.categoria || p.tipo, usado, limite, pct: limite ? Math.round((usado / limite) * 100) : 0 };
    })
    .filter((p) => p.limite && p.pct >= 80);
  const metasAlerts = data.metas
    .filter((m) => m.estado === 'activa')
    .filter((m) => Number(m.monto_objetivo || 0) > 0)
    .map((m) => ({ ...m, pct: Math.round((Number(m.monto_actual || 0) / Number(m.monto_objetivo || 0)) * 100) }))
    .filter((m) => m.pct >= 80)
    .slice(0, 3);

  return (
    <>
      <div className="dashboard-toolbar">
        <button className="btn" type="button" onClick={openDashboardConfig}><Settings size={16} />Configurar dashboard</button>
      </div>
      <div className="metrics-grid">
        {isVisible('balance') && <MetricCard icon={<Wallet />} label="Balance cuentas" value={money(balanceTotal)} helper={`${data.cuentas.length} cuentas activas`} chart={<MiniBarChart items={accountChart} />} />}
        {isVisible('pendiente') && <MetricCard icon={<CreditCard />} label="Pendiente por cobrar" value={money(pendiente)} helper={`${data.deudas.filter((d) => calcEstado(d) !== 'pagado').length} pendientes activos`} danger chart={<MiniBarChart items={debtChart} danger />} />}
        {isVisible('pagos') && <MetricCard icon={<Banknote />} label="Cobros del mes" value={money(pagosMes)} helper={`${data.pagos.filter((p) => p.fecha?.startsWith(month())).length} cobros`} chart={<MiniBarChart items={paymentsChart} />} />}
        {isVisible('movimientos') && <MetricCard icon={<TrendingUp />} label="Ingresos / Egresos" value={`${money(ingresos)} / ${money(egresos)}`} helper="Movimientos generales" chart={<MiniBarChart items={movementChart} split />} />}
      </div>
      {!visibleCards.length && <div className="card empty-dashboard"><div className="card-body muted">Activa al menos una tarjeta desde Configurar dashboard.</div></div>}
      <div className="grid-2">
        <ListCard title="Pendientes por vencer" empty="Sin pendientes por vencer" items={porVencer.map((d) => `${d.clientes?.nombre || ''} - ${d.descripcion}: ${money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0))}`)} />
        <ListCard title="Últimos cobros registrados" empty="Sin cobros registrados" items={data.pagos.slice(0, 5).map((p) => `${dateFmt(p.fecha)} - ${p.clientes?.nombre || ''}: ${money(p.monto)}`)} />
      </div>
      <div className="grid-2 dashboard-extra">
        <ListCard title="Alertas de presupuesto" empty="Sin presupuestos en alerta" items={presupuestoAlerts.map((p) => `${p.label}: ${money(p.usado)} de ${money(p.limite)} (${p.pct}%)`)} />
        <ListCard title="Metas próximas" empty="Sin metas próximas" items={metasAlerts.map((m) => `${m.nombre}: ${m.pct}% completado (${money(m.monto_actual)} / ${money(m.monto_objetivo)})`)} />
      </div>
      <Modal open={configOpen} title="Configurar dashboard" onClose={closeDashboardConfig}>
        <div className="modal-body">
          <p className="muted modal-intro">Elige qué tarjetas principales quieres ver al entrar al sistema.</p>
          <div className="dashboard-options">
            {DASHBOARD_CARD_OPTIONS.map((card) => (
              <label key={card.id} className="check-row">
                <input type="checkbox" checked={draftCards.includes(card.id)} onChange={() => toggleDraftCard(card.id)} />
                <span>{card.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" type="button" onClick={() => setDraftCards(DEFAULT_DASHBOARD_CARDS)}>Restablecer</button>
          <button className="btn" type="button" onClick={closeDashboardConfig}>Cancelar</button>
          <button className="btn btn-primary" type="button" onClick={saveDashboardConfig}>Guardar</button>
        </div>
      </Modal>
    </>
  );
}

function MetricCard({ icon, label, value, helper, danger = false, chart }) {
  return <div className="metric-card"><div className="metric-label">{icon}{label}</div><div className={`metric-value ${danger ? 'danger-text' : ''}`}>{value}</div>{chart}<div className="metric-change neutral">{helper}</div></div>;
}
function MiniBarChart({ items, danger = false, split = false }) {
  const cleanItems = items.filter((item) => Number(item.value || 0) > 0).slice(0, 8);
  const max = Math.max(...cleanItems.map((item) => Number(item.value || 0)), 1);
  if (!cleanItems.length) return <div className="mini-chart-empty">Sin datos para gráfico</div>;
  return (
    <div className="mini-chart">
      {cleanItems.map((item, index) => (
        <div className="mini-chart-row" key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <div className="mini-chart-track"><i className={`${danger ? 'danger' : ''} ${split && index === 1 ? 'danger' : ''}`} style={{ width: `${Math.max(8, (Number(item.value || 0) / max) * 100)}%` }} /></div>
          <b>{money(item.value)}</b>
        </div>
      ))}
    </div>
  );
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
  const [historial, setHistorial] = React.useState([]);
  const emptyForm = { banco: '', tipo: 'Ahorros', numero: '', cci: '', moneda: 'PEN', saldo: '' };
  const emptyTransfer = { tipo_destino: 'propia', cuenta_origen_id: '', cuenta_destino_id: '', banco_destino: '', numero_destino: '', titular_destino: '', monto: '', fecha: today(), notas: '' };
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [transferForm, setTransferForm] = React.useState(emptyTransfer);
  const load = React.useCallback(async () => {
    const [{ data: cuentasData }, { data: transferenciasData }, { data: movimientosData }, { data: pagosData }] = await Promise.all([
      supabase.from('cuentas').select('*').eq('admin_id', user.id).order('created_at', { ascending: false }),
      supabase.from('transferencias').select('*').eq('admin_id', user.id).order('fecha', { ascending: false }).limit(10),
      supabase.from('movimientos').select('id,fecha,tipo,concepto,monto,cuenta_id').eq('admin_id', user.id).order('fecha', { ascending: false }).limit(80),
      supabase.from('pagos').select('id,fecha,monto,metodo,cuenta_id,clientes(nombre,apellido)').eq('admin_id', user.id).order('fecha', { ascending: false }).limit(80),
    ]);
    setCuentas(cuentasData || []);
    setTransferencias(transferenciasData || []);
    setHistorial([
      ...(movimientosData || []).filter((m) => m.cuenta_id).map((m) => ({ fecha: m.fecha, cuenta_id: m.cuenta_id, tipo: m.tipo, detalle: m.concepto, monto: Number(m.monto || 0) })),
      ...(pagosData || []).filter((p) => p.cuenta_id).map((p) => ({ fecha: p.fecha, cuenta_id: p.cuenta_id, tipo: 'ingreso', detalle: `Pago ${p.metodo || ''} - ${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, monto: Number(p.monto || 0) })),
      ...(transferenciasData || []).flatMap((t) => [
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

function Deudas({ supabase, user, isAdmin }) {
  const [deudas, setDeudas] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const emptyDebtForm = { cliente_id: '', descripcion: '', monto_total: '', interes: '0', tipo: 'Venta', fecha_inicio: today(), fecha_vencimiento: '', notas: '' };
  const [form, setForm] = React.useState(emptyDebtForm);
  const load = React.useCallback(() => {
    const q = supabase.from('deudas').select('*,clientes(nombre,apellido,user_id)').order('fecha_vencimiento');
    q.eq('admin_id', user.id).neq('tipo', 'Préstamo').then(({ data }) => setDeudas((data || []).map((d) => ({ ...d, estado: calcEstado(d) }))));
  }, [supabase, user.id]);
  React.useEffect(() => {
    load();
    supabase.from('clientes').select('*').eq('admin_id', user.id).order('nombre').then(({ data }) => setClientes(data || []));
  }, [load, supabase, user.id]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyDebtForm);
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
    setForm(emptyDebtForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Pendientes por cobrar"
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva deuda</button>}
        columns={['Cliente', 'Descripción', 'Tipo', 'Total', 'Pendiente', 'Vencimiento', 'Estado']}
        rows={deudas.map((d) => [`${d.clientes?.nombre || ''} ${d.clientes?.apellido || ''}`, d.descripcion, d.tipo, money(d.monto_total), money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0)), dateFmt(d.fecha_vencimiento), badge(d.estado), <RowActions onEdit={() => openEdit(d)} onDelete={() => remove(d)} />])}
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
              <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })}><option>Venta</option><option>Servicio</option><option>Otro</option></SelectField>
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

function Prestamos({ supabase, user }) {
  const emptyForm = { cliente_id: '', descripcion: '', monto_total: '', interes: '0', cuenta_desembolso_id: '', fecha_inicio: today(), fecha_vencimiento: '', notas: '' };
  const [prestamos, setPrestamos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(async () => {
    const [prestamosQ, clientesQ, cuentasQ] = await Promise.all([
      supabase.from('deudas').select('*,clientes(nombre,apellido),cuentas(banco,tipo)').eq('admin_id', user.id).eq('tipo', 'Préstamo').order('fecha_inicio', { ascending: false }),
      supabase.from('clientes').select('*').eq('admin_id', user.id).order('nombre'),
      supabase.from('cuentas').select('*').eq('admin_id', user.id).order('banco'),
    ]);
    setPrestamos((prestamosQ.data || []).map((p) => ({ ...p, estado: calcEstado(p) })));
    setClientes(clientesQ.data || []);
    setCuentas(cuentasQ.data || []);
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(prestamo) {
    setEditingId(prestamo.id);
    setForm({
      cliente_id: prestamo.cliente_id || '',
      descripcion: prestamo.descripcion || '',
      monto_total: prestamo.monto_total ?? '',
      interes: prestamo.interes ?? '0',
      cuenta_desembolso_id: prestamo.cuenta_desembolso_id || '',
      fecha_inicio: prestamo.fecha_inicio || today(),
      fecha_vencimiento: prestamo.fecha_vencimiento || '',
      notas: prestamo.notas || '',
    });
    setOpen(true);
  }
  async function remove(prestamo) {
    if (!(await confirmAction(`Eliminar préstamo ${prestamo.descripcion || ''}? Se revertirá el desembolso.`))) return;
    const { error } = await supabase.rpc('eliminar_prestamo', { p_deuda_id: prestamo.id });
    if (error) {
      notify(error.message);
      return;
    }
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (!form.cliente_id || !form.descripcion || !form.monto_total || !form.cuenta_desembolso_id) {
      notify('Cliente, descripción, monto y cuenta origen son obligatorios.');
      return;
    }
    const basePayload = {
      p_cliente_id: form.cliente_id,
      p_descripcion: form.descripcion,
      p_monto_total: Number(form.monto_total || 0),
      p_interes: Number(form.interes || 0),
      p_fecha_inicio: form.fecha_inicio || today(),
      p_fecha_vencimiento: form.fecha_vencimiento || null,
      p_notas: form.notas || null,
      p_cuenta_desembolso_id: form.cuenta_desembolso_id,
    };
    const { error } = editingId
      ? await supabase.rpc('actualizar_prestamo', { p_deuda_id: editingId, ...basePayload })
      : await supabase.rpc('registrar_deuda_con_desembolso', { ...basePayload, p_tipo: 'Préstamo', p_desembolsar: true });
    if (error) {
      notify(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Préstamos otorgados"
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo préstamo</button>}
        columns={['Cliente', 'Descripción', 'Cuenta origen', 'Desembolsado', 'Cobrado', 'Pendiente', 'Estado']}
        rows={prestamos.map((p) => [`${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, p.descripcion, p.cuentas ? `${p.cuentas.banco} - ${p.cuentas.tipo || ''}` : '-', money(p.monto_total), money(p.monto_pagado), money(Number(p.monto_total || 0) - Number(p.monto_pagado || 0)), badge(p.estado), <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar préstamo' : 'Nuevo préstamo'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="alert alert-warning">Esta operación descuenta dinero de la cuenta origen y crea una deuda por cobrar al cliente.</div>
            <SelectField label="Cliente" value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v })}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellido || ''}</option>)}
            </SelectField>
            <SelectField label="Cuenta origen" value={form.cuenta_desembolso_id} onChange={(v) => setForm({ ...form, cuenta_desembolso_id: v })}>
              <option value="">Seleccionar cuenta...</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo} - {money(c.saldo)}</option>)}
            </SelectField>
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} placeholder="Préstamo personal, adelanto..." required />
            <div className="form-row">
              <Field label="Monto desembolsado" type="number" value={form.monto_total} onChange={(v) => setForm({ ...form, monto_total: v })} required />
              <Field label="Interés (%)" type="number" value={form.interes} onChange={(v) => setForm({ ...form, interes: v })} />
            </div>
            <div className="form-row">
              <Field label="Fecha desembolso" type="date" value={form.fecha_inicio} onChange={(v) => setForm({ ...form, fecha_inicio: v })} />
              <Field label="Vencimiento" type="date" value={form.fecha_vencimiento} onChange={(v) => setForm({ ...form, fecha_vencimiento: v })} />
            </div>
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><TrendingDown size={16} />{editingId ? 'Actualizar' : 'Desembolsar'}</button></div>
        </form>
      </Modal>
    </>
  );
}

function CobrosPrestamos({ supabase, user }) {
  const [pagos, setPagos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [prestamos, setPrestamos] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({ cliente_id: '', deuda_id: '', cuenta_id: '', monto: '', metodo: 'Transferencia', referencia: '', fecha: today(), notas: '' });
  const load = React.useCallback(async () => {
    const [pagosQ, clientesQ, prestamosQ, cuentasQ] = await Promise.all([
      supabase.from('pagos').select('*,clientes(nombre,apellido),deudas(descripcion,tipo),cuentas(banco)').eq('admin_id', user.id).order('fecha', { ascending: false }),
      supabase.from('clientes').select('*').eq('admin_id', user.id).order('nombre'),
      supabase.from('deudas').select('*,clientes(nombre,apellido)').eq('admin_id', user.id).eq('tipo', 'Préstamo'),
      supabase.from('cuentas').select('*').eq('admin_id', user.id).order('banco'),
    ]);
    setPagos((pagosQ.data || []).filter((p) => p.deudas?.tipo === 'Préstamo'));
    setClientes(clientesQ.data || []);
    setPrestamos((prestamosQ.data || []).map((p) => ({ ...p, estado: calcEstado(p) })));
    setCuentas(cuentasQ.data || []);
  }, [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  const prestamosCliente = prestamos.filter((p) => p.cliente_id === form.cliente_id && (editingId || calcEstado(p) !== 'pagado'));
  function openCreate() {
    setEditingId(null);
    setForm({ cliente_id: '', deuda_id: '', cuenta_id: '', monto: '', metodo: 'Transferencia', referencia: '', fecha: today(), notas: '' });
    setOpen(true);
  }
  function openEdit(pago) {
    setEditingId(pago.id);
    setForm({
      cliente_id: pago.cliente_id || '',
      deuda_id: pago.deuda_id || '',
      cuenta_id: pago.cuenta_id || '',
      monto: pago.monto ?? '',
      metodo: pago.metodo || 'Transferencia',
      referencia: pago.referencia || '',
      fecha: pago.fecha || today(),
      notas: pago.notas || '',
    });
    setOpen(true);
  }
  async function remove(pago) {
    if (!(await confirmAction('Eliminar este cobro? Se revertirá el saldo de la cuenta y el pendiente del préstamo.'))) return;
    const { error } = await supabase.rpc('eliminar_pago', { p_pago_id: pago.id });
    if (error) {
      notify(error.message);
      return;
    }
    load();
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
    setForm({ cliente_id: '', deuda_id: '', cuenta_id: '', monto: '', metodo: 'Transferencia', referencia: '', fecha: today(), notas: '' });
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Cobros de préstamos otorgados"
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Registrar cobro</button>}
        columns={['Fecha', 'Cliente', 'Préstamo', 'Monto', 'Método', 'Cuenta destino']}
        rows={pagos.map((p) => [dateFmt(p.fecha), `${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, p.deudas?.descripcion || '-', money(p.monto), p.metodo, p.cuentas?.banco || '-', <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar cobro de préstamo' : 'Registrar cobro de préstamo'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="alert alert-warning">Esta operación aumenta el saldo de la cuenta destino y reduce el pendiente del préstamo.</div>
            <SelectField label="Cliente" value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v, deuda_id: '' })}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellido || ''}</option>)}
            </SelectField>
            <SelectField label="Préstamo" value={form.deuda_id} onChange={(v) => setForm({ ...form, deuda_id: v })}>
              <option value="">Seleccionar préstamo...</option>
              {prestamosCliente.map((p) => <option key={p.id} value={p.id}>{p.descripcion} - pendiente {money(Number(p.monto_total || 0) - Number(p.monto_pagado || 0))}</option>)}
            </SelectField>
            <div className="form-row">
              <Field label="Monto cobrado" type="number" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} required />
              <Field label="Fecha de cobro" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} required />
            </div>
            <div className="form-row">
              <SelectField label="Método" value={form.metodo} onChange={(v) => setForm({ ...form, metodo: v })}><option>Efectivo</option><option>Transferencia</option><option>Yape</option><option>Plin</option><option>Depósito</option></SelectField>
              <SelectField label="Cuenta destino" value={form.cuenta_id} onChange={(v) => setForm({ ...form, cuenta_id: v })}><option value="">Sin cuenta</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo}</option>)}</SelectField>
            </div>
            <Field label="Referencia" value={form.referencia} onChange={(v) => setForm({ ...form, referencia: v })} />
            <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><TrendingUp size={16} />{editingId ? 'Actualizar cobro' : 'Registrar cobro'}</button></div>
        </form>
      </Modal>
    </>
  );
}

function PrestamosRecibidos({ supabase, user }) {
  const emptyForm = { acreedor: '', descripcion: '', monto_original: '', saldo_inicial: '', interes: '0', es_antiguo: true, cuenta_ingreso_id: '', fecha_inicio: today(), fecha_vencimiento: '', notas: '' };
  const [rows, setRows] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(async () => {
    const [prestamosQ, cuentasQ] = await Promise.all([
      supabase.from('prestamos_recibidos').select('*,cuentas(banco,tipo)').eq('admin_id', user.id).order('fecha_inicio', { ascending: false }),
      supabase.from('cuentas').select('*').eq('admin_id', user.id).order('banco'),
    ]);
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
    if (!(await confirmAction(`Eliminar préstamo recibido de ${row.acreedor || ''}?`))) return;
    const { error } = await supabase.rpc('eliminar_prestamo_recibido', { p_prestamo_id: row.id });
    if (error) return notify(error.message);
    load();
  }
  async function save(event) {
    event.preventDefault();
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
      ? await supabase.rpc('actualizar_prestamo_recibido', { p_prestamo_id: editingId, ...payload })
      : await supabase.rpc('registrar_prestamo_recibido', payload);
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
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo préstamo recibido</button>}
        columns={['Acreedor', 'Descripción', 'Tipo', 'Monto original', 'Pagado', 'Pendiente', 'Vencimiento', 'Estado']}
        rows={rows.map((row) => {
          const pendiente = Number(row.saldo_inicial || 0) - Number(row.monto_pagado || 0);
          return [row.acreedor, row.descripcion, row.es_antiguo ? 'Antiguo sin saldo' : `Ingreso a ${row.cuentas?.banco || '-'}`, money(row.monto_original), money(row.monto_pagado), money(pendiente), dateFmt(row.fecha_vencimiento), badge(estado(row)), <RowActions onEdit={() => openEdit(row)} onDelete={() => remove(row)} />];
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

function PagosPrestamosRecibidos({ supabase, user }) {
  const emptyForm = { prestamo_id: '', cuenta_id: '', monto: '', metodo: 'Transferencia', referencia: '', fecha: today(), notas: '' };
  const [pagos, setPagos] = React.useState([]);
  const [prestamos, setPrestamos] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(async () => {
    const [pagosQ, prestamosQ, cuentasQ] = await Promise.all([
      supabase.from('pagos_prestamos_recibidos').select('*,prestamos_recibidos(acreedor,descripcion),cuentas(banco)').eq('admin_id', user.id).order('fecha', { ascending: false }),
      supabase.from('prestamos_recibidos').select('*').eq('admin_id', user.id).order('fecha_inicio', { ascending: false }),
      supabase.from('cuentas').select('*').eq('admin_id', user.id).order('banco'),
    ]);
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
    if (!(await confirmAction('Eliminar este pago? Se revertirá el saldo de la cuenta y el pendiente.'))) return;
    const { error } = await supabase.rpc('eliminar_pago_prestamo_recibido', { p_pago_id: row.id });
    if (error) return notify(error.message);
    load();
  }
  async function save(event) {
    event.preventDefault();
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
      ? await supabase.rpc('actualizar_pago_prestamo_recibido', { p_pago_id: editingId, ...payload })
      : await supabase.rpc('registrar_pago_prestamo_recibido', payload);
    if (error) return notify(error.message);
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Pagos de préstamos recibidos"
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo pago</button>}
        columns={['Fecha', 'Acreedor', 'Préstamo', 'Monto', 'Método', 'Cuenta origen']}
        rows={pagos.map((p) => [dateFmt(p.fecha), p.prestamos_recibidos?.acreedor || '-', p.prestamos_recibidos?.descripcion || '-', money(p.monto), p.metodo, p.cuentas?.banco || '-', <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
      />
      <Modal open={open} title={editingId ? 'Editar pago de préstamo recibido' : 'Nuevo pago de préstamo recibido'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="alert alert-warning">Esta operación descuenta dinero de tu cuenta y reduce el préstamo que debes.</div>
            <SelectField label="Préstamo recibido" value={form.prestamo_id} onChange={(v) => setForm({ ...form, prestamo_id: v })}>
              <option value="">Seleccionar préstamo...</option>
              {prestamosPendientes.map((p) => <option key={p.id} value={p.id}>{p.acreedor} - {p.descripcion} - pendiente {money(Number(p.saldo_inicial || 0) - Number(p.monto_pagado || 0))}</option>)}
            </SelectField>
            <SelectField label="Cuenta origen del pago" value={form.cuenta_id} onChange={(v) => setForm({ ...form, cuenta_id: v })}>
              <option value="">Sin cuenta</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.banco} - {c.tipo} - {money(c.saldo)}</option>)}
            </SelectField>
            <div className="form-row">
              <Field label="Monto pagado" type="number" value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} required />
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
        title="Cobros generales"
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

function Presupuestos({ supabase, user }) {
  const emptyForm = { mes: month(), tipo: 'egreso', tipo_movimiento_id: '', categoria: '', monto_limite: '', notas: '' };
  const [rows, setRows] = React.useState([]);
  const [tipos, setTipos] = React.useState([]);
  const [movimientos, setMovimientos] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(async () => {
    const [presupuestos, tiposData, movimientosData] = await Promise.all([
      supabase.from('presupuestos').select('*,tipos_movimiento(nombre)').eq('admin_id', user.id).order('mes', { ascending: false }),
      supabase.from('tipos_movimiento').select('*').eq('admin_id', user.id).order('tipo').order('nombre'),
      supabase.from('movimientos').select('*').eq('admin_id', user.id),
    ]);
    setRows(presupuestos.data || []);
    setTipos(tiposData.data || []);
    setMovimientos(movimientosData.data || []);
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
      mes: row.mes || month(),
      tipo: row.tipo || 'egreso',
      tipo_movimiento_id: row.tipo_movimiento_id || '',
      categoria: row.categoria || '',
      monto_limite: row.monto_limite ?? '',
      notas: row.notas || '',
    });
    setOpen(true);
  }
  async function remove(row) {
    if (!(await confirmAction(`Eliminar presupuesto ${row.categoria || row.tipos_movimiento?.nombre || ''}?`))) return;
    const { error } = await supabase.from('presupuestos').delete().eq('id', row.id).eq('admin_id', user.id);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'presupuestos', 'delete', 'Presupuesto eliminado', row.id, row);
    load();
  }
  async function save(event) {
    event.preventDefault();
    const selected = tipos.find((t) => t.id === form.tipo_movimiento_id);
    const payload = {
      ...form,
      admin_id: user.id,
      tipo_movimiento_id: form.tipo_movimiento_id || null,
      categoria: selected?.nombre || form.categoria,
      monto_limite: Number(form.monto_limite || 0),
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await supabase.from('presupuestos').update(payload).eq('id', editingId).eq('admin_id', user.id)
      : await supabase.from('presupuestos').insert(payload);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'presupuestos', editingId ? 'update' : 'insert', editingId ? 'Presupuesto actualizado' : 'Presupuesto creado', editingId, payload);
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    load();
  }
  const tipoOptions = tipos.filter((t) => t.tipo === form.tipo);
  function usage(row) {
    const used = movimientos
      .filter((m) => m.fecha?.startsWith(row.mes) && m.tipo === row.tipo)
      .filter((m) => (row.tipo_movimiento_id && m.tipo_movimiento_id === row.tipo_movimiento_id) || (!row.tipo_movimiento_id && (m.categoria || '') === (row.categoria || '')))
      .reduce((sum, m) => sum + Number(m.monto || 0), 0);
    const limit = Number(row.monto_limite || 0);
    return { used, pct: limit ? Math.min(999, Math.round((used / limit) * 100)) : 0 };
  }
  return (
    <>
      <TableSection
        title="Presupuestos"
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo presupuesto</button>}
        columns={['Mes', 'Tipo', 'Categoría', 'Límite', 'Usado', 'Avance']}
        rows={rows.map((row) => {
          const u = usage(row);
          return [row.mes, badge(row.tipo), row.tipos_movimiento?.nombre || row.categoria || '-', money(row.monto_limite), money(u.used), <div className="progress-cell"><div className="progress-bar"><span style={{ width: `${Math.min(100, u.pct)}%` }} /></div><b>{u.pct}%</b></div>, <RowActions onEdit={() => openEdit(row)} onDelete={() => remove(row)} />];
        })}
      />
      <Modal open={open} title={editingId ? 'Editar presupuesto' : 'Nuevo presupuesto'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="form-row">
              <Field label="Mes" type="month" value={form.mes} onChange={(v) => setForm({ ...form, mes: v })} required />
              <SelectField label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v, tipo_movimiento_id: '' })}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></SelectField>
            </div>
            <SelectField label="Tipo de movimiento" value={form.tipo_movimiento_id} onChange={(v) => setForm({ ...form, tipo_movimiento_id: v })}>
              <option value="">Usar categoría manual...</option>
              {tipoOptions.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </SelectField>
            <Field label="Categoría manual" value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })} placeholder="Servicios, plataformas, proveedor..." />
            <Field label="Monto límite" type="number" value={form.monto_limite} onChange={(v) => setForm({ ...form, monto_limite: v })} required />
            <Field label="Notas" value={form.notas} onChange={(v) => setForm({ ...form, notas: v })} />
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
    </>
  );
}

function Metas({ supabase, user }) {
  const emptyForm = { nombre: '', descripcion: '', monto_objetivo: '', monto_actual: '', fecha_objetivo: '', estado: 'activa' };
  const [rows, setRows] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(() => supabase.from('metas').select('*').eq('admin_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setRows(data || [])), [supabase, user.id]);
  React.useEffect(() => { load(); }, [load]);
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(row) {
    setEditingId(row.id);
    setForm({ nombre: row.nombre || '', descripcion: row.descripcion || '', monto_objetivo: row.monto_objetivo ?? '', monto_actual: row.monto_actual ?? '', fecha_objetivo: row.fecha_objetivo || '', estado: row.estado || 'activa' });
    setOpen(true);
  }
  async function remove(row) {
    if (!(await confirmAction(`Eliminar meta ${row.nombre || ''}?`))) return;
    const { error } = await supabase.from('metas').delete().eq('id', row.id).eq('admin_id', user.id);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'metas', 'delete', 'Meta eliminada', row.id, row);
    load();
  }
  async function save(event) {
    event.preventDefault();
    const payload = { ...form, admin_id: user.id, monto_objetivo: Number(form.monto_objetivo || 0), monto_actual: Number(form.monto_actual || 0), fecha_objetivo: form.fecha_objetivo || null, updated_at: new Date().toISOString() };
    const { error } = editingId
      ? await supabase.from('metas').update(payload).eq('id', editingId).eq('admin_id', user.id)
      : await supabase.from('metas').insert(payload);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'metas', editingId ? 'update' : 'insert', editingId ? 'Meta actualizada' : 'Meta creada', editingId, payload);
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    load();
  }
  return (
    <>
      <TableSection
        title="Metas financieras"
        action={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva meta</button>}
        columns={['Meta', 'Objetivo', 'Actual', 'Avance', 'Fecha', 'Estado']}
        rows={rows.map((row) => {
          const pct = Number(row.monto_objetivo || 0) ? Math.round((Number(row.monto_actual || 0) / Number(row.monto_objetivo || 0)) * 100) : 0;
          return [row.nombre, money(row.monto_objetivo), money(row.monto_actual), <div className="progress-cell"><div className="progress-bar"><span style={{ width: `${Math.min(100, pct)}%` }} /></div><b>{pct}%</b></div>, dateFmt(row.fecha_objetivo), badge(row.estado), <RowActions onEdit={() => openEdit(row)} onDelete={() => remove(row)} />];
        })}
      />
      <Modal open={open} title={editingId ? 'Editar meta' : 'Nueva meta'} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <div className="modal-body">
            <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required />
            <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} />
            <div className="form-row">
              <Field label="Monto objetivo" type="number" value={form.monto_objetivo} onChange={(v) => setForm({ ...form, monto_objetivo: v })} required />
              <Field label="Monto actual" type="number" value={form.monto_actual} onChange={(v) => setForm({ ...form, monto_actual: v })} />
            </div>
            <div className="form-row">
              <Field label="Fecha objetivo" type="date" value={form.fecha_objetivo} onChange={(v) => setForm({ ...form, fecha_objetivo: v })} />
              <SelectField label="Estado" value={form.estado} onChange={(v) => setForm({ ...form, estado: v })}><option value="activa">Activa</option><option value="completada">Completada</option><option value="pausada">Pausada</option></SelectField>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary"><Check size={16} />Guardar</button></div>
        </form>
      </Modal>
    </>
  );
}

function Backup({ supabase, user }) {
  const [status, setStatus] = React.useState('');
  async function collectData() {
    const tables = ['profiles', 'clientes', 'cuentas', 'deudas', 'pagos', 'movimientos', 'tipos_movimiento', 'presupuestos', 'metas', 'auditoria'];
    const result = {};
    for (const table of tables) {
      const query = supabase.from(table).select('*');
      const { data, error } = table === 'profiles' ? await query.eq('id', user.id) : await query.eq('admin_id', user.id);
      result[table] = error ? { error: error.message } : data || [];
    }
    return result;
  }
  async function exportJson() {
    setStatus('Preparando backup...');
    const data = await collectData();
    downloadText(`fintrack-backup-${today()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), user_id: user.id, data }, null, 2));
    setStatus('Backup JSON generado.');
  }
  async function exportCsv(table) {
    const data = await collectData();
    const rows = Array.isArray(data[table]) ? data[table] : [];
    downloadText(`fintrack-${table}-${today()}.csv`, toCsv(rows), 'text/csv');
    setStatus(`CSV de ${table} generado.`);
  }
  return (
    <div className="grid-2">
      <div className="card"><div className="card-header"><h3>Backup completo</h3></div><div className="card-body">
        <p className="muted">Exporta una copia JSON con tus datos principales. Esto no restaura datos automáticamente; sirve como respaldo y auditoría.</p>
        <button className="btn btn-primary backup-button" onClick={exportJson}><FileDown size={16} />Descargar backup JSON</button>
        {status && <div className="connection-status success">{status}</div>}
      </div></div>
      <div className="card"><div className="card-header"><h3>Exportar CSV</h3></div><div className="card-body backup-actions">
        {['clientes', 'cuentas', 'deudas', 'pagos', 'movimientos', 'presupuestos', 'metas'].map((table) => <button key={table} className="btn" onClick={() => exportCsv(table)}><FileDown size={16} />{table}</button>)}
      </div></div>
    </div>
  );
}

function Auditoria({ supabase, user }) {
  const [rows, setRows] = React.useState([]);
  React.useEffect(() => {
    supabase.from('auditoria').select('*').eq('admin_id', user.id).order('created_at', { ascending: false }).limit(200).then(({ data }) => setRows(data || []));
  }, [supabase, user.id]);
  return <TableSection title="Auditoría" columns={['Fecha', 'Tabla', 'Acción', 'Descripción']} rows={rows.map((row) => [new Date(row.created_at).toLocaleString('es-PE'), row.tabla, row.accion, row.descripcion || '-'])} />;
}

function Reportes({ supabase, user }) {
  const [rows, setRows] = React.useState([]);
  const [movimientos, setMovimientos] = React.useState([]);
  const [presupuestos, setPresupuestos] = React.useState([]);
  const [metas, setMetas] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [cuentas, setCuentas] = React.useState([]);
  const [tipos, setTipos] = React.useState([]);
  const defaultFilters = React.useCallback(() => ({
    desde: `${month()}-01`,
    hasta: today(),
    cliente_id: '',
    cuenta_id: '',
    tipo: '',
    tipo_movimiento_id: '',
  }), []);
  const [filters, setFilters] = React.useState(defaultFilters);
  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  React.useEffect(() => {
    supabase.from('deudas').select('*,clientes(nombre,apellido)').eq('admin_id', user.id).then(({ data }) => setRows(data || []));
    supabase.from('movimientos').select('*,tipos_movimiento(nombre)').eq('admin_id', user.id).then(({ data }) => setMovimientos(data || []));
    supabase.from('presupuestos').select('*,tipos_movimiento(nombre)').eq('admin_id', user.id).then(({ data }) => setPresupuestos(data || []));
    supabase.from('metas').select('*').eq('admin_id', user.id).then(({ data }) => setMetas(data || []));
    supabase.from('clientes').select('id,nombre,apellido').eq('admin_id', user.id).order('nombre').then(({ data }) => setClientes(data || []));
    supabase.from('cuentas').select('id,banco,tipo').eq('admin_id', user.id).order('banco').then(({ data }) => setCuentas(data || []));
    supabase.from('tipos_movimiento').select('id,nombre,tipo').eq('admin_id', user.id).order('nombre').then(({ data }) => setTipos(data || []));
  }, [supabase, user.id]);
  const inDateRange = (fecha) => (!filters.desde || fecha >= filters.desde) && (!filters.hasta || fecha <= filters.hasta);
  const filteredRows = rows.filter((d) => (
    (!filters.cliente_id || d.cliente_id === filters.cliente_id) &&
    (!filters.desde || (d.fecha_inicio || d.created_at || '').slice(0, 10) >= filters.desde) &&
    (!filters.hasta || (d.fecha_inicio || d.created_at || '').slice(0, 10) <= filters.hasta)
  ));
  const filteredMovimientos = movimientos.filter((m) => (
    inDateRange(m.fecha) &&
    (!filters.cuenta_id || m.cuenta_id === filters.cuenta_id) &&
    (!filters.tipo || m.tipo === filters.tipo) &&
    (!filters.tipo_movimiento_id || m.tipo_movimiento_id === filters.tipo_movimiento_id)
  ));
  const summary = filteredRows.reduce((map, d) => {
    const name = `${d.clientes?.nombre || ''} ${d.clientes?.apellido || ''}`;
    map[name] ||= { total: 0, pagado: 0 };
    map[name].total += Number(d.monto_total || 0);
    map[name].pagado += Number(d.monto_pagado || 0);
    return map;
  }, {});
  const tableRows = Object.entries(summary).map(([name, r]) => [name, money(r.total), money(r.pagado), money(r.total - r.pagado), r.total - r.pagado <= 0 ? badge('pagado') : badge('vencido')]);
  const exportClientesCsv = () => {
    const csvRows = Object.entries(summary).map(([cliente, r]) => ({
      cliente,
      deuda_total: Number(r.total || 0).toFixed(2),
      pagado: Number(r.pagado || 0).toFixed(2),
      pendiente: Number((r.total || 0) - (r.pagado || 0)).toFixed(2),
      estado: r.total - r.pagado <= 0 ? 'Pagado' : 'Pendiente',
    }));
    downloadText(`fintrack-resumen-clientes-${today()}.csv`, toCsv(csvRows), 'text/csv');
  };
  const ingresos = filteredMovimientos.filter((m) => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto || 0), 0);
  const egresos = filteredMovimientos.filter((m) => m.tipo === 'egreso').reduce((sum, m) => sum + Number(m.monto || 0), 0);
  const movimientosPorTipo = filteredMovimientos.reduce((map, m) => {
    const key = `${m.tipo}:${m.tipos_movimiento?.nombre || m.categoria || 'Sin tipo'}`;
    map[key] ||= { tipo: m.tipo, categoria: m.tipos_movimiento?.nombre || m.categoria || 'Sin tipo', total: 0 };
    map[key].total += Number(m.monto || 0);
    return map;
  }, {});
  const filteredTipos = tipos.filter((tipo) => !filters.tipo || tipo.tipo === filters.tipo);
  const exportResumen = () => downloadText(`fintrack-reporte-${today()}.json`, JSON.stringify({
    filtros: filters,
    pendientes: summary,
    movimientos: Object.values(movimientosPorTipo),
    presupuestos,
    metas,
  }, null, 2));
  return (
    <>
      <div className="card report-filters">
        <div className="card-header">
          <h3>Filtros del reporte</h3>
        </div>
        <div className="card-body">
          <div className="report-filter-grid">
            <Field label="Desde" type="date" value={filters.desde} onChange={(value) => setFilter('desde', value)} />
            <Field label="Hasta" type="date" value={filters.hasta} onChange={(value) => setFilter('hasta', value)} />
            <SelectField label="Cliente" value={filters.cliente_id} onChange={(value) => setFilter('cliente_id', value)}>
              <option value="">Todos los clientes</option>
              {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre} {cliente.apellido}</option>)}
            </SelectField>
            <SelectField label="Cuenta" value={filters.cuenta_id} onChange={(value) => setFilter('cuenta_id', value)}>
              <option value="">Todas las cuentas</option>
              {cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.banco} {cuenta.tipo ? `- ${cuenta.tipo}` : ''}</option>)}
            </SelectField>
            <SelectField label="Tipo" value={filters.tipo} onChange={(value) => setFilters((current) => ({ ...current, tipo: value, tipo_movimiento_id: '' }))}>
              <option value="">Ingresos y egresos</option>
              <option value="ingreso">Solo ingresos</option>
              <option value="egreso">Solo egresos</option>
            </SelectField>
            <SelectField label="Categoría" value={filters.tipo_movimiento_id} onChange={(value) => setFilter('tipo_movimiento_id', value)}>
              <option value="">Todas las categorías</option>
              {filteredTipos.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
            </SelectField>
          </div>
          <div className="filter-actions">
            <button className="btn" type="button" onClick={() => setFilters(defaultFilters())}>Limpiar filtros</button>
          </div>
        </div>
      </div>
      <div className="metrics-grid">
        <MetricCard icon={<TrendingUp />} label="Ingresos filtrados" value={money(ingresos)} helper={`${filteredMovimientos.filter((m) => m.tipo === 'ingreso').length} movimientos`} />
        <MetricCard icon={<TrendingDown />} label="Egresos filtrados" value={money(egresos)} helper={`${filteredMovimientos.filter((m) => m.tipo === 'egreso').length} movimientos`} danger />
        <MetricCard icon={<ClipboardList />} label="Presupuestos" value={presupuestos.length} helper="Controles configurados" />
        <MetricCard icon={<Target />} label="Metas activas" value={metas.filter((m) => m.estado === 'activa').length} helper={`${metas.length} metas registradas`} />
      </div>
      <div className="action-bar"><div /><button className="btn btn-primary" onClick={exportResumen}><FileDown size={16} />Exportar reporte JSON</button></div>
      <TableSection title="Resumen por cliente" columns={['Cliente', 'Deuda total', 'Pagado', 'Pendiente', 'Estado']} rows={tableRows} onExport={exportClientesCsv} />
      <div className="report-spacer" />
      <TableSection title="Ingresos y egresos por tipo" columns={['Tipo', 'Categoría', 'Total']} rows={Object.values(movimientosPorTipo).map((row) => [badge(row.tipo), row.categoria, money(row.total)])} />
    </>
  );
}

function UsuariosAdmin({ supabase, user }) {
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({ nombre: '', apellido: '', tipo_doc: 'DNI', documento: '', email_contacto: '', telefono: '', direccion: '', empresa: '', moneda: 'PEN', role: 'user' });
  const load = React.useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_listar_usuarios');
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
    const { error } = await supabase.rpc('admin_actualizar_usuario', {
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
    const { error } = await supabase.rpc('admin_actualizar_usuario_estado', { p_user_id: row.id, p_activo: next });
    if (error) return notify(error.message);
    notify(next ? 'Usuario activado.' : 'Usuario desactivado.', 'success');
    load();
  }
  async function remove(row) {
    if (row.id === user.id) return notify('No puedes eliminar tu propio usuario.');
    if (!(await confirmAction(`Eliminar usuario ${row.email_contacto || row.nombre || ''}? Esto lo desactivará y ocultará su acceso.`))) return;
    const { error } = await supabase.rpc('admin_eliminar_usuario', { p_user_id: row.id });
    if (error) return notify(error.message);
    notify('Usuario eliminado lógicamente.', 'success');
    load();
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
          row.deleted_at ? <span className="badge badge-red">Eliminado</span> : <span className={`badge ${row.activo ? 'badge-green' : 'badge-yellow'}`}>{row.activo ? 'Activo' : 'Inactivo'}</span>,
          row.created_at ? new Date(row.created_at).toLocaleDateString('es-PE') : '-',
          row.id === user.id ? <span className="muted">Usuario actual</span> : <div className="row-actions"><button className="btn btn-sm btn-icon" type="button" title="Editar" onClick={() => openEdit(row)}><Pencil size={14} /></button><button className="btn btn-sm" type="button" onClick={() => toggle(row)}>{row.activo ? 'Desactivar' : 'Activar'}</button><button className="btn btn-sm btn-danger" type="button" onClick={() => remove(row)}>Eliminar</button></div>,
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
    </>
  );
}

function Perfil({ supabase, user, profile, onSaved }) {
  const [form, setForm] = React.useState({ nombre: '', apellido: '', tipo_doc: 'DNI', documento: '', email_contacto: '', telefono: '', direccion: '', empresa: '', moneda: 'PEN' });
  const [pinForm, setPinForm] = React.useState({ pin: '', confirm: '' });
  const [passwordForm, setPasswordForm] = React.useState({ password: '', confirm: '' });
  const [status, setStatus] = React.useState('');
  const [pinStatus, setPinStatus] = React.useState('');
  const [passwordStatus, setPasswordStatus] = React.useState('');
  const [showProfilePassword, setShowProfilePassword] = React.useState(false);
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
    const { error } = await updateProfile({ supabase, userId: user.id, form });
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus('Perfil actualizado correctamente.');
    onSaved();
  }
  async function savePin(event) {
    event.preventDefault();
    setPinStatus('');
    if (!/^\d{6}$/.test(pinForm.pin)) {
      setPinStatus('El PIN debe tener exactamente 6 dígitos.');
      return;
    }
    if (pinForm.pin !== pinForm.confirm) {
      setPinStatus('La confirmación del PIN no coincide.');
      return;
    }
    const { error } = await updateMobilePin({ supabase, userId: user.id, pin: pinForm.pin });
    if (error) {
      setPinStatus(error.message);
      return;
    }
    setPinForm({ pin: '', confirm: '' });
    setPinStatus('PIN actualizado correctamente.');
    onSaved();
  }
  async function savePassword(event) {
    event.preventDefault();
    setPasswordStatus('');
    if (passwordForm.password.length < 8) {
      setPasswordStatus('La contraseña debe tener mínimo 8 caracteres.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordStatus('La confirmación de contraseña no coincide.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
    if (error) {
      setPasswordStatus(error.message);
      return;
    }
    setPasswordForm({ password: '', confirm: '' });
    setPasswordStatus('Contraseña actualizada correctamente.');
  }
  const setPinField = (field, value) => setPinForm((current) => ({ ...current, [field]: value.replace(/\D/g, '').slice(0, 6) }));
  return <div className="profile-section">
    <div className="card profile-main-card"><div className="card-header"><h3>Información personal</h3></div><form className="card-body" onSubmit={save}>
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
    </form></div>
    <div className="profile-side">
      <div className="card pin-card"><div className="card-header"><h3>PIN móvil</h3></div><form className="card-body" onSubmit={savePin}>
        <p className="muted">Crea un PIN de 6 dígitos para desbloquear la app en este celular cuando uses “Recordar cuenta”.</p>
        <div className="form-row">
          <Field label="Nuevo PIN" type="password" value={pinForm.pin} onChange={(v) => setPinField('pin', v)} inputMode="numeric" pattern="\d{6}" placeholder="------" required minLength={6} />
          <Field label="Confirmar PIN" type="password" value={pinForm.confirm} onChange={(v) => setPinField('confirm', v)} inputMode="numeric" pattern="\d{6}" placeholder="------" required minLength={6} />
        </div>
        {pinStatus && <div className={`connection-status ${pinStatus.includes('correctamente') ? 'success' : ''}`}>{pinStatus}</div>}
        <button className="btn btn-primary"><Check size={16} />{profile?.pin_hash ? 'Cambiar PIN' : 'Crear PIN'}</button>
      </form></div>
      <div className="card pin-card"><div className="card-header"><h3>Contraseña</h3></div><form className="card-body" onSubmit={savePassword}>
        <p className="muted">Cambia la contraseña con la que inicias sesión por correo. El cambio aplica a tu cuenta de Supabase Auth.</p>
        <Field
          label="Nueva contraseña"
          type={showProfilePassword ? 'text' : 'password'}
          value={passwordForm.password}
          onChange={(v) => setPasswordForm({ ...passwordForm, password: v })}
          required
          minLength={8}
          rightElement={<button className="input-action" type="button" onClick={() => setShowProfilePassword((value) => !value)}>{showProfilePassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
        />
        <Field label="Confirmar contraseña" type={showProfilePassword ? 'text' : 'password'} value={passwordForm.confirm} onChange={(v) => setPasswordForm({ ...passwordForm, confirm: v })} required minLength={8} />
        {passwordStatus && <div className={`connection-status ${passwordStatus.includes('correctamente') ? 'success' : ''}`}>{passwordStatus}</div>}
        <button className="btn btn-primary"><Check size={16} />Cambiar contraseña</button>
      </form></div>
    </div>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}





