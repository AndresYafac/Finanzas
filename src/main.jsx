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
  Bell,
  Menu,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Search,
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
import { clearRememberedAccount, friendlyAuthError, sendPasswordReset, signInWithPassword, signUpUser } from './controllers/auth.controller';
import { updateMobilePin, updateProfile } from './controllers/profile.controller';
import { AppDialogs, AuthCard, Field, Modal, RowActions, SelectField, TableSection } from './components/ui';
import { clearFeedbackHandlers, confirmAction, hideBusy, notify, setFeedbackHandlers, showBusy } from './services/feedback';
import { storage } from './services/storage.service';
import { calcEstado, dateFmt, money, month, today } from './utils/format';
import { getPasswordStrength, validatePassword } from './utils/password';
import { hashPin, isMobileViewport } from './utils/security';
import './styles.css';

const LAST_PAGE_KEY = 'fintrack_last_page';
const COMPANY_CONFIG_KEY = 'fintrack_company_config';
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const INACTIVITY_WARNING_MS = 60 * 1000;
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

const DEFAULT_COMPANY_CONFIG = {
  nombre: 'FinTrack Pro',
  documento: '',
  direccion: '',
  telefono: '',
  logo_url: '',
  primary_color: '#1d9e75',
  theme: 'light',
};
const MODULE_PERMISSIONS = [
  ['dashboard', 'Dashboard'],
  ['clientes', 'Clientes'],
  ['cuentas', 'Cuentas bancarias'],
  ['deudas', 'Pendientes por cobrar'],
  ['prestamos', 'Préstamos otorgados'],
  ['cobros-prestamos', 'Cobros de préstamos'],
  ['prestamos-recibidos', 'Préstamos recibidos'],
  ['pagos-prestamos-recibidos', 'Pagos de préstamos recibidos'],
  ['pagos', 'Cobros generales'],
  ['movimientos', 'Ingresos / Egresos'],
  ['presupuestos', 'Presupuestos'],
  ['metas', 'Metas'],
  ['reportes', 'Reportes'],
  ['backup', 'Backup'],
  ['auditoria', 'Auditoría'],
];
const PERMISSION_FIELDS = [
  ['can_view', 'Ver'],
  ['can_create', 'Crear'],
  ['can_edit', 'Editar'],
  ['can_delete', 'Eliminar'],
  ['can_export', 'Exportar'],
];

function getCompanyConfig() {
  try {
    return { ...DEFAULT_COMPANY_CONFIG, ...(storage.getJson(COMPANY_CONFIG_KEY, {}) || {}) };
  } catch {
    return DEFAULT_COMPANY_CONFIG;
  }
}

function applyVisualConfig(config = getCompanyConfig()) {
  const root = document.documentElement;
  root.dataset.theme = config.theme === 'dark' ? 'dark' : 'light';
  root.style.setProperty('--primary', config.primary_color || DEFAULT_COMPANY_CONFIG.primary_color);
}

function App() {
  const [supabase, setSupabase] = React.useState(createStoredClient);
  const [session, setSession] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [page, setPage] = React.useState(() => {
    const savedPage = storage.getRaw(LAST_PAGE_KEY);
    return PAGE_IDS.includes(savedPage) ? savedPage : 'dashboard';
  });
  const [message, setMessage] = React.useState('');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [toast, setToast] = React.useState(null);
  const [confirmState, setConfirmState] = React.useState(null);
  const [busy, setBusy] = React.useState({ active: false, message: '' });
  const [installPrompt, setInstallPrompt] = React.useState(null);
  const [locked, setLocked] = React.useState(() => storage.getRaw(LOCKED_KEY) === '1');
  const [sidebarHidden, setSidebarHidden] = React.useState(() => storage.getRaw('fintrack_sidebar_hidden') === '1');
  const [updateWaiting, setUpdateWaiting] = React.useState(null);
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [permissions, setPermissions] = React.useState({});
  const [isMobile, setIsMobile] = React.useState(() => isMobileViewport());
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [offline, setOffline] = React.useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

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
    const syncVisualConfig = () => applyVisualConfig();
    syncVisualConfig();
    window.addEventListener('fintrack_visual_config', syncVisualConfig);
    return () => window.removeEventListener('fintrack_visual_config', syncVisualConfig);
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
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      if (registration.waiting) setUpdateWaiting(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateWaiting(worker);
          }
        });
      });
    });
  }, []);

  React.useEffect(() => {
    const syncViewport = () => setIsMobile(isMobileViewport());
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  React.useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') {
        setPage('perfil');
        storage.setRaw(LAST_PAGE_KEY, 'perfil');
        setMessage('Recuperación validada. Ingresa tu nueva contraseña en la sección Contraseña.');
      }
    });
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
      storage.remove(LOCKED_KEY);
      setLocked(false);
    }
  }, [locked, profile]);

  React.useEffect(() => {
    if (!supabase || !session?.user || locked) return undefined;
    let logoutTimer;
    let warningTimer;
    const resetTimers = () => {
      window.clearTimeout(logoutTimer);
      window.clearTimeout(warningTimer);
      warningTimer = window.setTimeout(() => notify('Tu sesión se cerrará en 1 minuto por inactividad.', 'warning'), INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS);
      logoutTimer = window.setTimeout(async () => {
        await supabase.auth.signOut();
        storage.remove(LOCKED_KEY);
        setSession(null);
        setProfile(null);
        notify('Sesión cerrada por inactividad.', 'success');
      }, INACTIVITY_TIMEOUT_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    resetTimers();
    events.forEach((eventName) => window.addEventListener(eventName, resetTimers, { passive: true }));
    return () => {
      window.clearTimeout(logoutTimer);
      window.clearTimeout(warningTimer);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimers));
    };
  }, [supabase, session?.user, locked]);

  React.useEffect(() => {
    if (!profile) return;
    const isAdminProfile = profile?.role === 'admin';
    const adminOnly = ['config', 'usuarios-admin'];
    if (!PAGE_IDS.includes(page) || (adminOnly.includes(page) && !isAdminProfile)) {
      setPage('dashboard');
      storage.setRaw(LAST_PAGE_KEY, 'dashboard');
      return;
    }
    storage.setRaw(LAST_PAGE_KEY, page);
  }, [page, profile]);

  React.useEffect(() => {
    async function loadPermissions() {
      if (!supabase || !session?.user || !profile) return;
      if (profile.role === 'admin') {
        setPermissions({});
        return;
      }
      const { data, error } = await supabase.from('user_permissions').select('*').eq('user_id', session.user.id);
      if (error) {
        setPermissions({});
        return;
      }
      setPermissions((data || []).reduce((map, row) => ({ ...map, [row.modulo]: row }), {}));
    }
    loadPermissions();
  }, [supabase, session?.user, profile]);

  if (!supabase) return <><Setup onReady={setSupabase} /><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  if (!session) return <><Auth supabase={supabase} message={message} setMessage={setMessage} /><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  if (locked && !profile) return <><AuthCard title="Desbloquear FinTrack"><p className="muted">Cargando cuenta recordada...</p></AuthCard><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  if (locked && profile?.pin_hash) {
    return <><PinUnlock supabase={supabase} profile={profile} onUnlock={() => {
      storage.remove(LOCKED_KEY);
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
  const can = (moduleId, action = 'view') => {
    if (isAdmin) return true;
    const row = permissions[moduleId];
    if (!row) return true;
    const map = { view: 'can_view', create: 'can_create', edit: 'can_edit', delete: 'can_delete', export: 'can_export' };
    return row[map[action]] !== false;
  };
  const pages = [
    ['principal', [
      ['dashboard', 'Dashboard', LayoutDashboard, can('dashboard')],
      ['clientes', 'Clientes', Users, can('clientes')],
    ]],
    ['finanzas', [
      ['cuentas', 'Cuentas bancarias', Building2, can('cuentas')],
      ['deudas', 'Pendientes por cobrar', CreditCard, can('deudas')],
      ['prestamos', 'Préstamos otorgados', TrendingDown, can('prestamos')],
      ['cobros-prestamos', 'Cobros de préstamos', TrendingUp, can('cobros-prestamos')],
      ['prestamos-recibidos', 'Préstamos recibidos', Banknote, can('prestamos-recibidos')],
      ['pagos-prestamos-recibidos', 'Pagos de préstamos', TrendingDown, can('pagos-prestamos-recibidos')],
      ['pagos', 'Cobros generales', Banknote, can('pagos')],
      ['movimientos', 'Ingresos / Egresos', Wallet, can('movimientos')],
      ['presupuestos', 'Presupuestos', ClipboardList, can('presupuestos')],
      ['metas', 'Metas', Target, can('metas')],
    ]],
    ['análisis', [
      ['reportes', 'Reportes', BarChart3, can('reportes')],
      ['backup', 'Backup', Database, can('backup')],
      ['auditoria', 'Auditoría', ShieldCheck, can('auditoria')],
    ]],
    ['sistema', [
      ['perfil', 'Mi perfil', UserCircle, true],
      ['usuarios-admin', 'Usuarios', Users, isAdmin],
      ['config', 'Configuración', Settings, isAdmin],
    ]],
  ];

  async function logout() {
    const canLock = isMobileViewport() && storage.getRaw(REMEMBER_KEY) === '1' && profile?.pin_hash;
    if (canLock) {
      storage.setRaw(LOCKED_KEY, '1');
      setLocked(true);
      return;
    }
    await supabase.auth.signOut();
    storage.remove(LOCKED_KEY);
    setSession(null);
    setProfile(null);
  }

  function openPage(nextPage) {
    if ((nextPage === 'config' || nextPage === 'usuarios-admin') && !isAdmin) return;
    if (!can(nextPage, 'view')) return notify('No tienes permiso para ver este módulo.');
    setPage(nextPage);
    setSidebarOpen(false);
  }

  function toggleMobileSidebar() {
    setAlertsOpen(false);
    setSidebarOpen((current) => !current);
  }

  function toggleSidebar() {
    setSidebarHidden((current) => {
      const next = !current;
      localStorage.setItem('fintrack_sidebar_hidden', next ? '1' : '0');
      return next;
    });
  }

  function applyUpdate() {
    if (!updateWaiting) return;
    updateWaiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }

  const currentTitle = pageTitle(page, isAdmin);

  return (
    <div className={`layout ${sidebarHidden ? 'sidebar-hidden' : ''} ${isMobile ? 'layout-mobile' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className={`offline-indicator ${offline ? 'visible' : ''}`}>Sin conexión. Algunas funciones pueden no estar disponibles.</div>
      {isMobile && <button className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} type="button" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
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
          <div className="user-mini" onClick={() => openPage('perfil')}>
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
          {isMobile ? (
            <>
            <div className="topbar-left">
              <button className="btn btn-icon mobile-menu-button" type="button" onClick={toggleMobileSidebar} title="Menú" aria-label="Abrir menú">
                <Menu size={24} />
              </button>
              <div>
                <h2>{currentTitle[0]}</h2>
                <p>{currentTitle[1]}</p>
              </div>
            </div>
            <div className="topbar-mobile-actions">
              <AlertsButton supabase={supabase} user={session.user} open={alertsOpen} setOpen={setAlertsOpen} onOpenPage={openPage} />
              {updateWaiting && <button className="btn btn-icon" type="button" onClick={applyUpdate} title="Actualizar app" aria-label="Actualizar app"><RefreshCw size={18} /></button>}
              {installPrompt && <button className="btn btn-icon btn-primary" type="button" title="Instalar app" aria-label="Instalar app" onClick={async () => {
                await installPrompt.prompt();
                setInstallPrompt(null);
              }}><Download size={18} /></button>}
              <button className="btn btn-icon mobile-logout-btn" onClick={logout} title="Salir" aria-label="Salir">
                <LogOut size={18} />
              </button>
            </div>
            <div className="topbar-mobile-search">
              <GlobalSearch supabase={supabase} user={session.user} onOpenPage={openPage} />
            </div>
            </>
          ) : (
            <>
            <div className="topbar-left">
              <button className="btn btn-icon sidebar-toggle" type="button" onClick={toggleSidebar} title={sidebarHidden ? 'Mostrar menú' : 'Ocultar menú'}>
                <Menu size={24} />
              </button>
              <div>
                <h2>{currentTitle[0]}</h2>
                <p>{currentTitle[1]}</p>
              </div>
            </div>
            <div className="topbar-actions">
              <GlobalSearch supabase={supabase} user={session.user} onOpenPage={openPage} />
              <AlertsButton supabase={supabase} user={session.user} open={alertsOpen} setOpen={setAlertsOpen} onOpenPage={openPage} />
              {updateWaiting && <button className="btn" type="button" onClick={applyUpdate}><RefreshCw size={16} />Actualizar app</button>}
              {installPrompt && <button className="btn btn-primary" onClick={async () => {
                await installPrompt.prompt();
                setInstallPrompt(null);
              }}><Download size={16} />Instalar app</button>}
            </div>
            </>
          )}
        </div>
        {message && <div className="alert alert-danger">{message}</div>}
        <div className={`page active page-${page}`}>
          {page === 'dashboard' && <Dashboard supabase={supabase} user={session.user} isAdmin={isAdmin} />}
          {page === 'clientes' && <Clientes supabase={supabase} user={session.user} can={(action) => can('clientes', action)} />}
          {page === 'cuentas' && <Cuentas supabase={supabase} user={session.user} can={(action) => can('cuentas', action)} />}
          {page === 'deudas' && <Deudas supabase={supabase} user={session.user} isAdmin={isAdmin} can={(action) => can('deudas', action)} />}
          {page === 'prestamos' && <Prestamos supabase={supabase} user={session.user} can={(action) => can('prestamos', action)} />}
          {page === 'cobros-prestamos' && <CobrosPrestamos supabase={supabase} user={session.user} can={(action) => can('cobros-prestamos', action)} />}
          {page === 'prestamos-recibidos' && <PrestamosRecibidos supabase={supabase} user={session.user} can={(action) => can('prestamos-recibidos', action)} />}
          {page === 'pagos-prestamos-recibidos' && <PagosPrestamosRecibidos supabase={supabase} user={session.user} can={(action) => can('pagos-prestamos-recibidos', action)} />}
          {page === 'pagos' && <Pagos supabase={supabase} user={session.user} isAdmin={isAdmin} can={(action) => can('pagos', action)} />}
          {page === 'movimientos' && <Movimientos supabase={supabase} user={session.user} isAdmin={isAdmin} can={(action) => can('movimientos', action)} />}
          {page === 'presupuestos' && <Presupuestos supabase={supabase} user={session.user} can={(action) => can('presupuestos', action)} />}
          {page === 'metas' && <Metas supabase={supabase} user={session.user} can={(action) => can('metas', action)} />}
          {page === 'reportes' && <Reportes supabase={supabase} user={session.user} can={(action) => can('reportes', action)} />}
          {page === 'backup' && <Backup supabase={supabase} user={session.user} can={(action) => can('backup', action)} />}
          {page === 'auditoria' && <Auditoria supabase={supabase} user={session.user} can={(action) => can('auditoria', action)} />}
          {page === 'perfil' && <Perfil supabase={supabase} user={session.user} profile={profile} onSaved={() => setRefreshKey((x) => x + 1)} />}
          {page === 'usuarios-admin' && isAdmin && <UsuariosAdmin supabase={supabase} user={session.user} />}
          {page === 'config' && isAdmin && <Config onReady={setSupabase} />}
        </div>
      </main>
      <AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} />
    </div>
  );
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
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
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const parseLine = (line) => {
    const values = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values.map((value) => value.trim());
  };
  const headers = parseLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {});
  });
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}
function shortJson(value) {
  if (!value) return '-';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}
async function logAudit(supabase, userId, tabla, accion, descripcion, registro_id = null, datos = null) {
  const { error } = await supabase.rpc('registrar_auditoria_avanzada', {
    p_tabla: tabla,
    p_accion: accion,
    p_descripcion: descripcion,
    p_registro_id: registro_id,
    p_datos_antes: accion === 'delete' ? datos : null,
    p_datos_despues: accion === 'delete' ? null : datos,
  });
  if (error) {
    await supabase.from('auditoria').insert({ admin_id: userId, tabla, accion, descripcion, registro_id, datos });
  }
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

function GlobalSearch({ supabase, user, onOpenPage }) {
  const [query, setQuery] = React.useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    async function search() {
      const term = debouncedQuery.trim().replace(/[,%()]/g, ' ');
      if (term.length < 2) {
        setResults([]);
        return;
      }
      const like = `%${term}%`;
      const [clientes, cuentas, deudas, pagos, movimientos] = await Promise.all([
        supabase.from('clientes').select('id,nombre,apellido,email,telefono').eq('admin_id', user.id).or(`nombre.ilike.${like},apellido.ilike.${like},email.ilike.${like},telefono.ilike.${like}`).limit(5),
        supabase.from('cuentas').select('id,banco,tipo,moneda').eq('admin_id', user.id).or(`banco.ilike.${like},tipo.ilike.${like}`).limit(5),
        supabase.from('deudas').select('id,descripcion,tipo,clientes(nombre,apellido)').eq('admin_id', user.id).or(`descripcion.ilike.${like},tipo.ilike.${like}`).limit(5),
        supabase.from('pagos').select('id,referencia,metodo,clientes(nombre,apellido)').eq('admin_id', user.id).or(`referencia.ilike.${like},metodo.ilike.${like},notas.ilike.${like}`).limit(5),
        supabase.from('movimientos').select('id,descripcion,categoria,tipo').eq('admin_id', user.id).or(`descripcion.ilike.${like},categoria.ilike.${like},tipo.ilike.${like}`).limit(5),
      ]);
      if (cancelled) return;
      setResults([
        ...(clientes.data || []).map((r) => ({ page: 'clientes', title: `${r.nombre || ''} ${r.apellido || ''}`.trim() || 'Cliente', meta: r.email || r.telefono || 'Cliente', type: 'Cliente' })),
        ...(cuentas.data || []).map((r) => ({ page: 'cuentas', title: r.banco || 'Cuenta', meta: `${r.tipo || '-'} · ${r.moneda || 'PEN'}`, type: 'Cuenta' })),
        ...(deudas.data || []).map((r) => ({ page: r.tipo === 'Préstamo' ? 'prestamos' : 'deudas', title: r.descripcion || r.tipo || 'Pendiente', meta: `${r.clientes?.nombre || ''} ${r.clientes?.apellido || ''}`.trim(), type: r.tipo === 'Préstamo' ? 'Préstamo' : 'Pendiente' })),
        ...(pagos.data || []).map((r) => ({ page: 'pagos', title: r.referencia || r.metodo || 'Cobro', meta: `${r.clientes?.nombre || ''} ${r.clientes?.apellido || ''}`.trim(), type: 'Cobro' })),
        ...(movimientos.data || []).map((r) => ({ page: 'movimientos', title: r.descripcion || r.categoria || 'Movimiento', meta: r.tipo, type: 'Movimiento' })),
      ].slice(0, 8));
    }
    const timer = window.setTimeout(search, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [debouncedQuery, supabase, user.id]);
  function selectResult(result) {
    onOpenPage(result.page);
    setQuery('');
    setResults([]);
    setOpen(false);
  }
  return (
    <div className="global-search">
      <Search size={16} />
      <input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder="Buscar..." />
      {open && query.trim().length >= 2 && (
        <div className="global-search-results">
          {results.length ? results.map((result, index) => (
            <button key={`${result.page}-${index}`} type="button" onClick={() => selectResult(result)}>
              <span><b>{result.title}</b><small>{result.meta || result.type}</small></span>
              <em>{result.type}</em>
            </button>
          )) : <div className="global-search-empty">Sin resultados</div>}
        </div>
      )}
    </div>
  );
}

function AlertsButton({ supabase, user, open, setOpen, onOpenPage }) {
  const [alerts, setAlerts] = React.useState([]);
  React.useEffect(() => {
    async function load() {
      const [deudas, presupuestos, movimientos, metas, cuentas, prestamosRecibidos] = await Promise.all([
        supabase.from('deudas').select('id,descripcion,fecha_vencimiento,monto_total,monto_pagado,tipo,clientes(nombre,apellido)').eq('admin_id', user.id),
        supabase.from('presupuestos').select('id,categoria,tipo,monto_limite,tipo_movimiento_id,tipos_movimiento(nombre)').eq('admin_id', user.id).eq('mes', month()),
        supabase.from('movimientos').select('id,tipo,categoria,tipo_movimiento_id,monto,fecha').eq('admin_id', user.id).gte('fecha', `${month()}-01`).lte('fecha', today()),
        supabase.from('metas').select('id,nombre,monto_objetivo,monto_actual,fecha_objetivo,estado').eq('admin_id', user.id).eq('estado', 'activa'),
        supabase.from('cuentas').select('id,banco,tipo,saldo,moneda').eq('admin_id', user.id),
        supabase.from('prestamos_recibidos').select('id,acreedor,descripcion,monto_original,saldo_inicial,monto_pagado,fecha_vencimiento').eq('admin_id', user.id),
      ]);
      const debtAlerts = (deudas.data || [])
        .filter((d) => calcEstado(d) === 'vencido' || calcEstado(d) === 'por_vencer')
        .slice(0, 5)
        .map((d) => ({ page: d.tipo === 'Préstamo' ? 'prestamos' : 'deudas', level: calcEstado(d) === 'vencido' ? 'danger' : 'warning', title: calcEstado(d) === 'vencido' ? 'Pendiente vencido' : 'Pendiente por vencer', text: `${d.descripcion || 'Sin descripción'} · ${money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0))}` }));
      const budgetAlerts = (presupuestos.data || []).map((p) => {
        const used = (movimientos.data || [])
          .filter((m) => m.tipo === p.tipo && ((p.tipo_movimiento_id && m.tipo_movimiento_id === p.tipo_movimiento_id) || (!p.tipo_movimiento_id && (m.categoria || '') === (p.categoria || ''))))
          .reduce((sum, m) => sum + Number(m.monto || 0), 0);
        const limit = Number(p.monto_limite || 0);
        return { p, used, limit, pct: limit ? Math.round((used / limit) * 100) : 0 };
      }).filter((item) => item.limit && item.pct >= 80).slice(0, 4).map((item) => ({
        page: 'presupuestos',
        level: item.pct >= 100 ? 'danger' : 'warning',
        title: item.pct >= 100 ? 'Presupuesto superado' : 'Presupuesto en alerta',
        text: `${item.p.tipos_movimiento?.nombre || item.p.categoria || item.p.tipo}: ${item.pct}%`,
      }));
      const goalAlerts = (metas.data || [])
        .filter((m) => m.fecha_objetivo && m.fecha_objetivo <= today())
        .slice(0, 3)
        .map((m) => ({ page: 'metas', level: 'warning', title: 'Meta por revisar', text: `${m.nombre}: ${money(m.monto_actual)} / ${money(m.monto_objetivo)}` }));
      const lowBalanceAlerts = (cuentas.data || [])
        .filter((c) => Number(c.saldo || 0) <= 0)
        .slice(0, 3)
        .map((c) => ({ page: 'cuentas', level: 'warning', title: 'Saldo bajo', text: `${c.banco || 'Cuenta'} ${c.tipo || ''}: ${money(c.saldo || 0)}` }));
      const receivedLoanAlerts = (prestamosRecibidos.data || [])
        .filter((p) => p.fecha_vencimiento && (calcEstado({ fecha_vencimiento: p.fecha_vencimiento, monto_total: p.saldo_inicial || p.monto_original, monto_pagado: p.monto_pagado }) !== 'al_dia'))
        .slice(0, 4)
        .map((p) => ({ page: 'prestamos-recibidos', level: 'warning', title: 'Préstamo recibido por pagar', text: `${p.acreedor || p.descripcion || 'Acreedor'}: ${money(Number(p.saldo_inicial || p.monto_original || 0) - Number(p.monto_pagado || 0))}` }));
      setAlerts([...debtAlerts, ...budgetAlerts, ...goalAlerts, ...lowBalanceAlerts, ...receivedLoanAlerts]);
    }
    load();
  }, [supabase, user.id]);
  return (
    <div className="alerts-menu">
      <button className={`btn btn-icon alerts-button ${alerts.length ? 'has-new' : ''}`} type="button" onClick={() => setOpen(!open)} title="Alertas" aria-label={`Alertas${alerts.length ? `: ${alerts.length}` : ''}`}>
        <Bell size={24} className={alerts.length ? 'bell-icon-animated' : ''} />
        {!!alerts.length && <span className="alerts-count">{alerts.length}</span>}
      </button>
      {open && (
        <div className="alerts-panel">
          <h4>Alertas</h4>
          {alerts.length ? alerts.map((alert, index) => (
            <button key={`${alert.title}-${index}`} type="button" onClick={() => { onOpenPage(alert.page); setOpen(false); }}>
              <b className={alert.level === 'danger' ? 'danger-text' : ''}>{alert.title}</b>
              <small>{alert.text}</small>
            </button>
          )) : <div className="global-search-empty">Sin alertas por ahora</div>}
        </div>
      )}
    </div>
  );
}

function Setup({ onReady }) {
  return <AuthCard title="Conectar Supabase"><Config onReady={onReady} compact /></AuthCard>;
}

function Auth({ supabase, message, setMessage }) {
  const [mode, setMode] = React.useState('login');
  const [form, setForm] = React.useState({ nombre: '', apellido: '', email: storage.getRaw(REMEMBER_EMAIL_KEY), password: '' });
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(storage.getRaw(REMEMBER_KEY) === '1');
  const [loading, setLoading] = React.useState(false);
  const passwordStrength = getPasswordStrength(form.password, form.email);
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'reset') {
        if (!form.email.trim()) {
          setMessage('Ingresa tu correo para enviar el enlace de recuperación.');
          return;
        }
        const { error } = await sendPasswordReset({ supabase, email: form.email });
        if (error) {
          setMessage(friendlyAuthError(error));
        } else {
          setMessage('Te enviamos un enlace para recuperar tu contraseña. Revisa bandeja de entrada y spam.');
        }
        return;
      }
      if (mode === 'login') {
        const { error } = await signInWithPassword({
          supabase,
          email: form.email,
          password: form.password,
          remember,
        });
        if (error) setMessage(friendlyAuthError(error));
        return;
      }
      const passwordError = validatePassword(form.password, form.email);
      if (passwordError) {
        setMessage(passwordError);
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
        setMessage(rateLimited ? 'Supabase alcanzó el límite temporal de correos. Espera o configura SMTP propio.' : friendlyAuthError(error));
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
      {mode !== 'reset' ? (
        <div className="auth-tabs">
          <button type="button" className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Iniciar sesión</button>
          <button type="button" className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Registrarse</button>
        </div>
      ) : (
        <div className="auth-reset-title">
          <strong>Recuperar contraseña</strong>
          <span>Te enviaremos un enlace seguro a tu correo.</span>
        </div>
      )}
      <form onSubmit={submit}>
        {mode === 'register' && (
          <div className="form-row">
            <Field label="Nombre" value={form.nombre} onChange={(value) => setField('nombre', value)} maxLength={80} />
            <Field label="Apellido" value={form.apellido} onChange={(value) => setField('apellido', value)} maxLength={80} />
          </div>
        )}
        <Field label="Correo electrónico" type="email" value={form.email} onChange={(value) => setField('email', value)} required maxLength={254} autoComplete="email" />
        {mode !== 'reset' && (
          <Field
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(value) => setField('password', value)}
            required
            minLength={8}
            maxLength={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            rightElement={<button className="input-action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
          />
        )}
        {mode === 'register' && (
          <div className={`password-strength password-strength-${passwordStrength.label.toLowerCase()}`}>
            <div className="password-strength-head">
              <span>Seguridad de contraseña</span>
              <strong>{passwordStrength.label}</strong>
            </div>
            <div className="password-strength-track"><i style={{ width: `${passwordStrength.score}%` }} /></div>
            <div className="password-checks">
              {passwordStrength.checks.map(([key, label, ok]) => (
                <span key={key} className={ok ? 'ok' : ''}>{ok ? '✓' : '•'} {label}</span>
              ))}
            </div>
          </div>
        )}
        {mode === 'login' && (
          <label className="check-row">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Recordar cuenta y usar PIN en este celular</span>
          </label>
        )}
        <button className="btn-full" disabled={loading}>
          {loading ? (mode === 'login' ? 'Ingresando...' : mode === 'reset' ? 'Enviando enlace...' : 'Creando cuenta...') : (mode === 'login' ? 'Entrar al sistema' : mode === 'reset' ? 'Enviar enlace' : 'Crear cuenta de cliente')}
        </button>
        {message && <div className="auth-error">{message}</div>}
        {mode === 'login' && <button type="button" className="link-button" onClick={() => { setMessage(''); setMode('reset'); }}>Olvidé mi contraseña</button>}
        {mode === 'reset' && <button type="button" className="link-button" onClick={() => { setMessage(''); setMode('login'); }}>Volver al inicio de sesión</button>}
      </form>
    </AuthCard>
  );
}

function PinUnlock({ profile, onUnlock, onFullLogout }) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [attempts, setAttempts] = React.useState(0);
  const [lockedUntil, setLockedUntil] = React.useState(() => Number(storage.getRaw('fintrack_pin_locked_until', '0') || 0));

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (lockedUntil && Date.now() < lockedUntil) {
      setError(`PIN bloqueado temporalmente. Intenta nuevamente en ${Math.ceil((lockedUntil - Date.now()) / 60000)} min.`);
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('Ingresa tu PIN de 6 dígitos.');
      return;
    }
    const nextHash = await hashPin(pin, profile.pin_salt);
    if (nextHash !== profile.pin_hash) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        const until = Date.now() + 5 * 60 * 1000;
        storage.setRaw('fintrack_pin_locked_until', String(until));
        setLockedUntil(until);
        setAttempts(0);
        setError('Demasiados intentos fallidos. PIN bloqueado por 5 minutos.');
      } else {
        setError(`PIN incorrecto. Intentos restantes: ${5 - nextAttempts}.`);
      }
      setPin('');
      return;
    }
    storage.remove('fintrack_pin_locked_until');
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
  const [company, setCompany] = React.useState(getCompanyConfig);
  const logoInputRef = React.useRef(null);
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (compact) return;
    const client = createStoredClient();
    if (!client) return;
    client.from('empresa_config').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        const next = {
          nombre: data.nombre || DEFAULT_COMPANY_CONFIG.nombre,
          documento: data.documento || '',
          direccion: data.direccion || '',
          telefono: data.telefono || '',
          logo_url: data.logo_url || '',
          primary_color: data.primary_color || DEFAULT_COMPANY_CONFIG.primary_color,
          theme: data.theme || DEFAULT_COMPANY_CONFIG.theme,
        };
        setCompany(next);
        localStorage.setItem(COMPANY_CONFIG_KEY, JSON.stringify(next));
        applyVisualConfig(next);
      }
    });
  }, [compact]);

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

  async function saveCompany(event) {
    event.preventDefault();
    localStorage.setItem(COMPANY_CONFIG_KEY, JSON.stringify(company));
    applyVisualConfig(company);
    window.dispatchEvent(new Event('fintrack_visual_config'));
    const client = createStoredClient();
    if (client) {
      const { data: sessionData } = await client.auth.getSession();
      const adminId = sessionData.session?.user?.id;
      if (adminId) {
        await client.from('empresa_config').upsert({ admin_id: adminId, ...company, updated_at: new Date().toISOString() }, { onConflict: 'admin_id' });
      }
    }
    setStatus('Datos de empresa guardados correctamente.');
  }
  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const client = createStoredClient();
    if (!client) {
      setStatus('Configura Supabase antes de subir el logo.');
      return;
    }
    const { data: sessionData } = await client.auth.getSession();
    const adminId = sessionData.session?.user?.id;
    if (!adminId) return setStatus('Inicia sesión para subir el logo.');
    const ext = file.name.split('.').pop() || 'png';
    const path = `${adminId}/logo-${Date.now()}.${ext}`;
    const { error } = await client.storage.from('empresa-assets').upload(path, file, { upsert: true });
    if (error) {
      setStatus(error.message);
      return;
    }
    const { data } = client.storage.from('empresa-assets').getPublicUrl(path);
    setCompany((current) => ({ ...current, logo_url: data.publicUrl }));
    setStatus('Logo subido. Guarda los datos de empresa para conservarlo.');
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
          {!compact && (
            <form className="config-company-form" onSubmit={saveCompany}>
              <h4>Datos de empresa para reportes</h4>
              <Field label="Nombre comercial" value={company.nombre} onChange={(v) => setCompany({ ...company, nombre: v })} />
              <Field label="RUC / Documento" value={company.documento} onChange={(v) => setCompany({ ...company, documento: v })} />
              <Field label="Dirección" value={company.direccion} onChange={(v) => setCompany({ ...company, direccion: v })} />
              <Field label="Teléfono" value={company.telefono} onChange={(v) => setCompany({ ...company, telefono: v })} />
              <Field label="URL del logo" value={company.logo_url} onChange={(v) => setCompany({ ...company, logo_url: v })} placeholder="https://..." />
              <div className="form-row">
                <SelectField label="Tema visual" value={company.theme || 'light'} onChange={(v) => setCompany({ ...company, theme: v })}>
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                </SelectField>
                <Field label="Color principal" type="color" value={company.primary_color || DEFAULT_COMPANY_CONFIG.primary_color} onChange={(v) => setCompany({ ...company, primary_color: v })} />
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={uploadLogo} />
              <button className="btn" type="button" onClick={() => logoInputRef.current?.click()}>Subir logo</button>
              <button className="btn btn-primary"><Check size={16} />Guardar datos de empresa</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const DASHBOARD_CARDS_KEY = 'fintrack_dashboard_cards';
const DASHBOARD_CARD_OPTIONS = [
  { id: 'balance', label: 'Balance de cuentas', description: 'Saldo total y distribución por cuenta.', Icon: Wallet },
  { id: 'pendiente', label: 'Pendiente por cobrar', description: 'Deudas activas y monto pendiente.', Icon: CreditCard },
  { id: 'pagos', label: 'Cobros del mes', description: 'Cobros registrados durante el mes actual.', Icon: Banknote },
  { id: 'movimientos', label: 'Ingresos / Egresos', description: 'Resumen general de movimientos.', Icon: TrendingUp },
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
          <div className="dashboard-config-hero">
            <div>
              <strong>Personaliza tu resumen</strong>
              <p>Activa solo las tarjetas que necesitas ver al iniciar sesión.</p>
            </div>
            <span>{draftCards.length}/{DASHBOARD_CARD_OPTIONS.length} activas</span>
          </div>
          <div className="dashboard-options-grid">
            {DASHBOARD_CARD_OPTIONS.map((card) => {
              const active = draftCards.includes(card.id);
              const Icon = card.Icon;
              return (
                <button key={card.id} type="button" className={`dashboard-option-card ${active ? 'active' : ''}`} onClick={() => toggleDraftCard(card.id)}>
                  <span className="dashboard-option-icon"><Icon size={22} /></span>
                  <span className="dashboard-option-copy">
                    <b>{card.label}</b>
                    <small>{card.description}</small>
                  </span>
                  <span className="dashboard-option-check">{active ? <Check size={16} /> : null}</span>
                </button>
              );
            })}
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

function Clientes({ supabase, user, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
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
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
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

function Cuentas({ supabase, user, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
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
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
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
    if (!can('create')) return notify('No tienes permiso para crear transferencias.');
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
      <div className="action-bar"><div></div><div className="table-actions">{can('create') && <button className="btn" onClick={() => setTransferOpen(true)}><ArrowRightLeft size={16} />Nueva transferencia</button>}{can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva cuenta</button>}</div></div>
      <div className="grid-3">{cuentas.map((c) => <div className="account-card account-card-hover" key={c.id}><div className="account-card-actions"><RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(c)} onDelete={() => remove(c)} /></div><Building2 /><strong>{c.banco}</strong><span>{c.tipo} - {c.moneda}</span><b>{money(c.saldo)}</b></div>)}</div>
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

function Deudas({ supabase, user, isAdmin, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
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
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva deuda</button>}
        columns={['Cliente', 'Descripción', 'Tipo', 'Total', 'Pendiente', 'Vencimiento', 'Estado']}
        rows={deudas.map((d) => [`${d.clientes?.nombre || ''} ${d.clientes?.apellido || ''}`, d.descripcion, d.tipo, money(d.monto_total), money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0)), dateFmt(d.fecha_vencimiento), badge(d.estado), <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(d)} onDelete={() => remove(d)} />])}
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

function Prestamos({ supabase, user, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar préstamo ${prestamo.descripcion || ''}? Se revertirá el desembolso.`))) return;
    const { error } = await supabase.rpc('eliminar_prestamo', { p_deuda_id: prestamo.id });
    if (error) {
      notify(error.message);
      return;
    }
    await logAudit(supabase, user.id, 'prestamos', 'delete', 'Préstamo eliminado', prestamo.id, prestamo);
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
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
    await logAudit(supabase, user.id, 'clientes', editingId ? 'update' : 'insert', editingId ? 'Cliente actualizado' : 'Cliente creado', editingId, form);
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Préstamos otorgados"
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo préstamo</button>}
        columns={['Cliente', 'Descripción', 'Cuenta origen', 'Desembolsado', 'Cobrado', 'Pendiente', 'Estado']}
        rows={prestamos.map((p) => [`${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, p.descripcion, p.cuentas ? `${p.cuentas.banco} - ${p.cuentas.tipo || ''}` : '-', money(p.monto_total), money(p.monto_pagado), money(Number(p.monto_total || 0) - Number(p.monto_pagado || 0)), badge(p.estado), <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
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

function CobrosPrestamos({ supabase, user, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction('Eliminar este cobro? Se revertirá el saldo de la cuenta y el pendiente del préstamo.'))) return;
    const { error } = await supabase.rpc('eliminar_pago', { p_pago_id: pago.id });
    if (error) {
      notify(error.message);
      return;
    }
    await logAudit(supabase, user.id, 'cuentas', 'delete', 'Cuenta eliminada', cuenta.id, cuenta);
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
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
    await logAudit(supabase, user.id, 'cuentas', editingId ? 'update' : 'insert', editingId ? 'Cuenta actualizada' : 'Cuenta creada', editingId, payload);
    setForm({ cliente_id: '', deuda_id: '', cuenta_id: '', monto: '', metodo: 'Transferencia', referencia: '', fecha: today(), notas: '' });
    setEditingId(null);
    setOpen(false);
    load();
  }
  return (
    <>
      <TableSection
        title="Cobros de préstamos otorgados"
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Registrar cobro</button>}
        columns={['Fecha', 'Cliente', 'Préstamo', 'Monto', 'Método', 'Cuenta destino']}
        rows={pagos.map((p) => [dateFmt(p.fecha), `${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, p.deudas?.descripcion || '-', money(p.monto), p.metodo, p.cuentas?.banco || '-', <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
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

function PrestamosRecibidos({ supabase, user, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar préstamo recibido de ${row.acreedor || ''}?`))) return;
    const { error } = await supabase.rpc('eliminar_prestamo_recibido', { p_prestamo_id: row.id });
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

function PagosPrestamosRecibidos({ supabase, user, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction('Eliminar este pago? Se revertirá el saldo de la cuenta y el pendiente.'))) return;
    const { error } = await supabase.rpc('eliminar_pago_prestamo_recibido', { p_pago_id: row.id });
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
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo pago</button>}
        columns={['Fecha', 'Acreedor', 'Préstamo', 'Monto', 'Método', 'Cuenta origen']}
        rows={pagos.map((p) => [dateFmt(p.fecha), p.prestamos_recibidos?.acreedor || '-', p.prestamos_recibidos?.descripcion || '-', money(p.monto), p.metodo, p.cuentas?.banco || '-', <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
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

function Pagos({ supabase, user, isAdmin, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
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
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Registrar pago</button>}
        columns={['Fecha', 'Cliente', 'Deuda', 'Monto', 'Método', 'Cuenta']}
        rows={pagos.map((p) => [dateFmt(p.fecha), `${p.clientes?.nombre || ''} ${p.clientes?.apellido || ''}`, p.deudas?.descripcion || '-', money(p.monto), p.metodo, p.cuentas?.banco || '-', <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(p)} onDelete={() => remove(p)} />])}
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

function Movimientos({ supabase, user, isAdmin, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
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
    if (tipoEditingId && !can('edit')) return notify('No tienes permiso para editar tipos.');
    if (!tipoEditingId && !can('create')) return notify('No tienes permiso para crear tipos.');
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
    if (!can('delete')) return notify('No tienes permiso para eliminar tipos.');
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

function Presupuestos({ supabase, user, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar presupuesto ${row.categoria || row.tipos_movimiento?.nombre || ''}?`))) return;
    const { error } = await supabase.from('presupuestos').delete().eq('id', row.id).eq('admin_id', user.id);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'presupuestos', 'delete', 'Presupuesto eliminado', row.id, row);
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
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
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo presupuesto</button>}
        columns={['Mes', 'Tipo', 'Categoría', 'Límite', 'Usado', 'Avance']}
        rows={rows.map((row) => {
          const u = usage(row);
          return [row.mes, badge(row.tipo), row.tipos_movimiento?.nombre || row.categoria || '-', money(row.monto_limite), money(u.used), <div className="progress-cell"><div className="progress-bar"><span style={{ width: `${Math.min(100, u.pct)}%` }} /></div><b>{u.pct}%</b></div>, <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(row)} onDelete={() => remove(row)} />];
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

function Metas({ supabase, user, can = () => true }) {
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
    if (!can('delete')) return notify('No tienes permiso para eliminar.');
    if (!(await confirmAction(`Eliminar meta ${row.nombre || ''}?`))) return;
    const { error } = await supabase.from('metas').delete().eq('id', row.id).eq('admin_id', user.id);
    if (error) return notify(error.message);
    await logAudit(supabase, user.id, 'metas', 'delete', 'Meta eliminada', row.id, row);
    load();
  }
  async function save(event) {
    event.preventDefault();
    if (editingId && !can('edit')) return notify('No tienes permiso para editar.');
    if (!editingId && !can('create')) return notify('No tienes permiso para crear.');
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
        action={can('create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nueva meta</button>}
        columns={['Meta', 'Objetivo', 'Actual', 'Avance', 'Fecha', 'Estado']}
        rows={rows.map((row) => {
          const pct = Number(row.monto_objetivo || 0) ? Math.round((Number(row.monto_actual || 0) / Number(row.monto_objetivo || 0)) * 100) : 0;
          return [row.nombre, money(row.monto_objetivo), money(row.monto_actual), <div className="progress-cell"><div className="progress-bar"><span style={{ width: `${Math.min(100, pct)}%` }} /></div><b>{pct}%</b></div>, dateFmt(row.fecha_objetivo), badge(row.estado), <RowActions canEdit={can('edit')} canDelete={can('delete')} onEdit={() => openEdit(row)} onDelete={() => remove(row)} />];
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

function Backup({ supabase, user, can = () => true }) {
  const [status, setStatus] = React.useState('');
  const clientesFileRef = React.useRef(null);
  const movimientosFileRef = React.useRef(null);
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
    if (!can('export')) return notify('No tienes permiso para exportar.');
    setStatus('Preparando backup...');
    const data = await collectData();
    downloadText(`fintrack-backup-${today()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), user_id: user.id, data }, null, 2));
    setStatus('Backup JSON generado.');
  }
  async function exportCsv(table) {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    const data = await collectData();
    const rows = Array.isArray(data[table]) ? data[table] : [];
    downloadText(`fintrack-${table}-${today()}.csv`, toCsv(rows), 'text/csv');
    setStatus(`CSV de ${table} generado.`);
  }
  function downloadTemplate(type) {
    const content = type === 'clientes'
      ? 'nombre,apellido,tipo_doc,documento,telefono,email,direccion,notas\nJuan,Perez,DNI,12345678,999999999,juan@email.com,Direccion,Nota\n'
      : 'fecha,tipo,categoria,descripcion,monto\n2026-07-01,egreso,Servicios,Internet,120.00\n';
    downloadText(`plantilla-${type}.csv`, content, 'text/csv');
  }
  async function importCsvFile(event, type) {
    if (!can('create')) return notify('No tienes permiso para importar.');
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('Importando CSV...');
    let rows = [];
    if (file.name.toLowerCase().endsWith('.xlsx')) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
        .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).toLowerCase(), String(value)])));
    } else {
      rows = parseCsv(await file.text());
    }
    if (!rows.length) {
      setStatus('El archivo no tiene datos.');
      event.target.value = '';
      return;
    }
    const errors = [];
    const payload = rows.map((row, index) => {
      if (type === 'clientes') {
        const mapped = {
          admin_id: user.id,
          nombre: row.nombre || row.name || '',
          apellido: row.apellido || '',
          tipo_doc: row.tipo_doc || 'DNI',
          documento: row.documento || '',
          telefono: row.telefono || '',
          email: row.email || '',
          direccion: row.direccion || '',
          notas: row.notas || '',
        };
        if (!mapped.nombre) errors.push(`Fila ${index + 2}: falta nombre`);
        return mapped;
      }
      const monto = Number(String(row.monto || '0').replace(',', '.'));
      const mapped = {
        admin_id: user.id,
        fecha: row.fecha || today(),
        tipo: row.tipo === 'ingreso' ? 'ingreso' : 'egreso',
        categoria: row.categoria || 'Importado',
        descripcion: row.descripcion || row.detalle || 'Importado CSV',
        monto,
      };
      if (!mapped.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(mapped.fecha)) errors.push(`Fila ${index + 2}: fecha inválida`);
      if (!Number.isFinite(monto) || monto <= 0) errors.push(`Fila ${index + 2}: monto inválido`);
      return mapped;
    }).filter((row) => type === 'clientes' ? row.nombre : row.monto > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.fecha));
    if (!payload.length) {
      setStatus('No se encontraron filas válidas para importar.');
      event.target.value = '';
      return;
    }
    const { error } = await supabase.from(type === 'clientes' ? 'clientes' : 'movimientos').insert(payload);
    if (error) setStatus(error.message);
    else setStatus(`${payload.length} registros importados en ${type}.${errors.length ? ` ${errors.length} filas omitidas: ${errors.slice(0, 3).join('; ')}` : ''}`);
    event.target.value = '';
  }
  return (
    <div className="grid-2">
      <div className="card"><div className="card-header"><h3>Backup completo</h3></div><div className="card-body">
        <p className="muted">Exporta una copia JSON con tus datos principales. Esto no restaura datos automáticamente; sirve como respaldo y auditoría.</p>
        {can('export') && <button className="btn btn-primary backup-button" onClick={exportJson}><FileDown size={16} />Descargar backup JSON</button>}
        {status && <div className="connection-status success">{status}</div>}
      </div></div>
      <div className="card"><div className="card-header"><h3>Exportar CSV</h3></div><div className="card-body backup-actions">
        {can('export') ? ['clientes', 'cuentas', 'deudas', 'pagos', 'movimientos', 'presupuestos', 'metas'].map((table) => <button key={table} className="btn" onClick={() => exportCsv(table)}><FileDown size={16} />{table}</button>) : <p className="muted">No tienes permiso para exportar.</p>}
      </div></div>
      <div className="card"><div className="card-header"><h3>Importar CSV</h3></div><div className="card-body backup-actions">
        <input ref={clientesFileRef} type="file" accept=".csv,.xlsx,text/csv" hidden onChange={(event) => importCsvFile(event, 'clientes')} />
        <input ref={movimientosFileRef} type="file" accept=".csv,.xlsx,text/csv" hidden onChange={(event) => importCsvFile(event, 'movimientos')} />
        <button className="btn" type="button" onClick={() => downloadTemplate('clientes')}><FileDown size={16} />Plantilla clientes</button>
        {can('create') && <button className="btn btn-primary" type="button" onClick={() => clientesFileRef.current?.click()}>Importar clientes</button>}
        <button className="btn" type="button" onClick={() => downloadTemplate('movimientos')}><FileDown size={16} />Plantilla movimientos</button>
        {can('create') && <button className="btn btn-primary" type="button" onClick={() => movimientosFileRef.current?.click()}>Importar movimientos</button>}
      </div></div>
    </div>
  );
}

function Auditoria({ supabase, user, can = () => true }) {
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [action, setAction] = React.useState('');
  React.useEffect(() => {
    supabase.from('auditoria').select('*').eq('admin_id', user.id).order('created_at', { ascending: false }).limit(200).then(({ data }) => setRows(data || []));
  }, [supabase, user.id]);
  const filtered = rows.filter((row) => {
    const text = `${row.tabla || ''} ${row.accion || ''} ${row.descripcion || ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!action || row.accion === action);
  });
  const exportCsv = () => {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    return downloadText(`fintrack-auditoria-${today()}.csv`, toCsv(filtered.map((row) => ({
    fecha: row.created_at ? new Date(row.created_at).toLocaleString('es-PE') : '',
    tabla: row.tabla,
    accion: row.accion,
    descripcion: row.descripcion,
    registro_id: row.registro_id,
    datos_antes: shortJson(row.datos_antes || (row.accion === 'delete' ? row.datos : null)),
    datos_despues: shortJson(row.datos_despues || (row.accion !== 'delete' ? row.datos : null)),
    }))), 'text/csv');
  };
  return (
    <>
      <div className="card report-filters"><div className="card-body audit-filters">
        <Field label="Buscar" value={query} onChange={setQuery} placeholder="Tabla, acción o descripción..." />
        <SelectField label="Acción" value={action} onChange={setAction}><option value="">Todas</option><option value="insert">Insertar</option><option value="update">Actualizar</option><option value="delete">Eliminar</option></SelectField>
        {can('export') && <button className="btn" type="button" onClick={exportCsv}><FileDown size={16} />Exportar auditoría</button>}
      </div></div>
      <TableSection title="Auditoría" columns={['Fecha', 'Tabla', 'Acción', 'Descripción', 'Datos']} rows={filtered.map((row) => [new Date(row.created_at).toLocaleString('es-PE'), row.tabla, row.accion, row.descripcion || '-', <code>{shortJson(row.datos_despues || row.datos_antes || row.datos)}</code>])} />
    </>
  );
}

function Reportes({ supabase, user, can = () => true }) {
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
    if (!can('export')) return notify('No tienes permiso para exportar.');
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
  const exportResumen = () => {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    return downloadText(`fintrack-reporte-${today()}.json`, JSON.stringify({
      filtros: filters,
      pendientes: summary,
      movimientos: Object.values(movimientosPorTipo),
      presupuestos,
      metas,
    }, null, 2));
  };
  const exportPdf = () => {
    if (!can('export')) return notify('No tienes permiso para exportar.');
    const company = getCompanyConfig();
    const movimientosRows = Object.values(movimientosPorTipo);
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Reporte FinTrack ${today()}</title>
          <style>
            body{font-family:Arial,sans-serif;color:#0f1923;margin:32px}
            .header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:2px solid #0f765f;padding-bottom:18px}
            .company{display:flex;gap:14px;align-items:center}
            .logo{width:58px;height:58px;border-radius:16px;object-fit:cover;background:#1d9e75}
            h1{margin:0 0 4px;font-size:24px} h2{font-size:16px;margin-top:24px}
            .muted{color:#60758a;font-size:12px;margin-bottom:20px}
            .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
            .card{border:1px solid #dce6ef;border-radius:14px;padding:14px}
            .label{color:#60758a;font-size:11px;text-transform:uppercase;font-weight:700}
            .value{font-size:20px;font-weight:800;margin-top:6px}
            table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
            th,td{border-bottom:1px solid #e1e9f0;padding:9px;text-align:left}
            th{background:#f3f7fa;color:#51677f;text-transform:uppercase;font-size:10px}
            @media print{button{display:none} body{margin:20px}}
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">
              ${company.logo_url ? `<img class="logo" src="${escapeHtml(company.logo_url)}" />` : '<div class="logo"></div>'}
              <div>
                <h1>${escapeHtml(company.nombre || 'FinTrack Pro')}</h1>
                <div class="muted">${escapeHtml(company.documento || '')}${company.direccion ? ` · ${escapeHtml(company.direccion)}` : ''}${company.telefono ? ` · ${escapeHtml(company.telefono)}` : ''}</div>
              </div>
            </div>
            <div class="muted">Generado: ${escapeHtml(new Date().toLocaleString('es-PE'))}<br/>Desde ${escapeHtml(filters.desde || '-')} hasta ${escapeHtml(filters.hasta || '-')}</div>
          </div>
          <div class="cards">
            <div class="card"><div class="label">Ingresos</div><div class="value">${escapeHtml(money(ingresos))}</div></div>
            <div class="card"><div class="label">Egresos</div><div class="value">${escapeHtml(money(egresos))}</div></div>
            <div class="card"><div class="label">Presupuestos</div><div class="value">${presupuestos.length}</div></div>
            <div class="card"><div class="label">Metas activas</div><div class="value">${metas.filter((m) => m.estado === 'activa').length}</div></div>
          </div>
          <h2>Resumen por cliente</h2>
          <table><thead><tr><th>Cliente</th><th>Deuda total</th><th>Pagado</th><th>Pendiente</th></tr></thead><tbody>
            ${Object.entries(summary).map(([cliente, r]) => `<tr><td>${escapeHtml(cliente)}</td><td>${escapeHtml(money(r.total))}</td><td>${escapeHtml(money(r.pagado))}</td><td>${escapeHtml(money(r.total - r.pagado))}</td></tr>`).join('') || '<tr><td colspan="4">Sin datos</td></tr>'}
          </tbody></table>
          <h2>Ingresos y egresos por tipo</h2>
          <table><thead><tr><th>Tipo</th><th>Categoría</th><th>Total</th></tr></thead><tbody>
            ${movimientosRows.map((row) => `<tr><td>${escapeHtml(row.tipo)}</td><td>${escapeHtml(row.categoria)}</td><td>${escapeHtml(money(row.total))}</td></tr>`).join('') || '<tr><td colspan="3">Sin datos</td></tr>'}
          </tbody></table>
          <script>window.onload=()=>{window.print();}</script>
        </body>
      </html>`;
    const win = window.open('', '_blank');
    if (!win) return notify('El navegador bloqueó la ventana del PDF. Permite ventanas emergentes para exportar.');
    win.document.write(html);
    win.document.close();
  };
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
      <div className="action-bar"><div /><div className="table-actions">{can('export') && <button className="btn" onClick={exportPdf}><FileDown size={16} />Exportar PDF</button>}{can('export') && <button className="btn btn-primary" onClick={exportResumen}><FileDown size={16} />Exportar reporte JSON</button>}</div></div>
      <TableSection title="Resumen por cliente" columns={['Cliente', 'Deuda total', 'Pagado', 'Pendiente', 'Estado']} rows={tableRows} onExport={can('export') ? exportClientesCsv : null} />
      <div className="report-spacer" />
      <TableSection title="Ingresos y egresos por tipo" columns={['Tipo', 'Categoría', 'Total']} rows={Object.values(movimientosPorTipo).map((row) => [badge(row.tipo), row.categoria, money(row.total)])} />
    </>
  );
}

function UsuariosAdmin({ supabase, user }) {
  const [rows, setRows] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [permissionsOpen, setPermissionsOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [permissionsUser, setPermissionsUser] = React.useState(null);
  const [permissionRows, setPermissionRows] = React.useState({});
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
  async function openPermissions(row) {
    if (row.id === user.id) return notify('No necesitas configurar permisos para tu propio usuario.');
    setPermissionsUser(row);
    const defaults = MODULE_PERMISSIONS.reduce((map, [modulo]) => ({
      ...map,
      [modulo]: { modulo, can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false },
    }), {});
    const { data, error } = await supabase.from('user_permissions').select('*').eq('user_id', row.id);
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
  async function savePermissions(event) {
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
    const { error } = await supabase.from('user_permissions').upsert(payload, { onConflict: 'user_id,modulo' });
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
          row.deleted_at ? <span className="badge badge-red">Eliminado</span> : <span className={`badge ${row.activo ? 'badge-green' : 'badge-yellow'}`}>{row.activo ? 'Activo' : 'Inactivo'}</span>,
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
        <form onSubmit={savePermissions}>
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
                    <span className={`badge ${row.can_view ? 'badge-green' : 'badge-gray'}`}>{row.can_view ? 'Visible' : 'Oculto'}</span>
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

function Perfil({ supabase, user, profile, onSaved }) {
  const [form, setForm] = React.useState({ nombre: '', apellido: '', tipo_doc: 'DNI', documento: '', email_contacto: '', telefono: '', direccion: '', empresa: '', moneda: 'PEN' });
  const [pinForm, setPinForm] = React.useState({ pin: '', confirm: '' });
  const [passwordForm, setPasswordForm] = React.useState({ password: '', confirm: '' });
  const [status, setStatus] = React.useState('');
  const [pinStatus, setPinStatus] = React.useState('');
  const [passwordStatus, setPasswordStatus] = React.useState('');
  const [showProfilePassword, setShowProfilePassword] = React.useState(false);
  const profilePasswordStrength = getPasswordStrength(passwordForm.password, user.email);
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
    const passwordError = validatePassword(passwordForm.password, user.email);
    if (passwordError) {
      setPasswordStatus(passwordError);
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
  async function signOutEverywhere() {
    if (!(await confirmAction('Cerrar sesión en todos tus dispositivos? Tendrás que volver a iniciar sesión.'))) return;
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      setPasswordStatus(error.message);
      return;
    }
    clearRememberedAccount();
    window.location.reload();
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
        <div className={`password-strength password-strength-${profilePasswordStrength.label.toLowerCase()}`}>
          <div className="password-strength-head">
            <span>Seguridad de contraseña</span>
            <strong>{profilePasswordStrength.label}</strong>
          </div>
          <div className="password-strength-track"><i style={{ width: `${profilePasswordStrength.score}%` }} /></div>
          <div className="password-checks">
            {profilePasswordStrength.checks.map(([key, label, ok]) => (
              <span key={key} className={ok ? 'ok' : ''}>{ok ? '✓' : '•'} {label}</span>
            ))}
          </div>
        </div>
        <Field label="Confirmar contraseña" type={showProfilePassword ? 'text' : 'password'} value={passwordForm.confirm} onChange={(v) => setPasswordForm({ ...passwordForm, confirm: v })} required minLength={8} />
      {passwordStatus && <div className={`connection-status ${passwordStatus.includes('correctamente') ? 'success' : ''}`}>{passwordStatus}</div>}
      <div className="table-actions">
        <button className="btn btn-primary"><Check size={16} />Cambiar contraseña</button>
        <button className="btn btn-danger" type="button" onClick={signOutEverywhere}><LogOut size={16} />Cerrar sesión en todos</button>
      </div>
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
