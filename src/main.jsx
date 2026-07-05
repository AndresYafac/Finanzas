import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  Banknote,
  Building2,
  ClipboardList,
  CreditCard,
  Database,
  LayoutDashboard,
  Bell,
  Search,
  ShieldCheck,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react';
import { createStoredClient } from './config/supabase';
import { applyVisualConfig, getCompanyConfig } from './config/visualConfig';
import { LOCKED_KEY, REMEMBER_KEY } from './constants/authStorage';
import { clearRememberedAccount } from './controllers/auth.controller';
import { Auth, PinUnlock } from './components/auth/Auth';
import { AppLayout } from './components/layout/AppLayout';
import { AppDialogs, AuthCard } from './components/ui';
import { Config } from './pages/Config';
import { clearFeedbackHandlers, confirmAction, hideBusy, notify, setFeedbackHandlers, showBusy } from './services/feedback';
import { getProfile, listUserPermissions } from './services/admin.service';
import { getAlertData } from './services/dashboard.service';
import { globalSearch } from './services/search.service';
import { storage } from './services/storage.service';
import { calcEstado, money, month, today } from './utils/format';
import { isMobileViewport } from './utils/security';
import './styles.css';

const lazyPage = (loader, exportName) => React.lazy(() => loader().then((module) => ({ default: module[exportName] })));

const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'Dashboard');
const Perfil = lazyPage(() => import('./pages/Perfil'), 'Perfil');
const Clientes = lazyPage(() => import('./pages/finance/Clientes'), 'Clientes');
const Cuentas = lazyPage(() => import('./pages/finance/Cuentas'), 'Cuentas');
const Deudas = lazyPage(() => import('./pages/finance/Deudas'), 'Deudas');
const Prestamos = lazyPage(() => import('./pages/finance/Prestamos'), 'Prestamos');
const CobrosPrestamos = lazyPage(() => import('./pages/finance/CobrosPrestamos'), 'CobrosPrestamos');
const PrestamosRecibidos = lazyPage(() => import('./pages/finance/PrestamosRecibidos'), 'PrestamosRecibidos');
const PagosPrestamosRecibidos = lazyPage(() => import('./pages/finance/PagosPrestamosRecibidos'), 'PagosPrestamosRecibidos');
const Pagos = lazyPage(() => import('./pages/finance/Pagos'), 'Pagos');
const Movimientos = lazyPage(() => import('./pages/finance/Movimientos'), 'Movimientos');
const Presupuestos = lazyPage(() => import('./pages/finance/Presupuestos'), 'Presupuestos');
const Metas = lazyPage(() => import('./pages/finance/Metas'), 'Metas');
const Reportes = lazyPage(() => import('./pages/finance/Reportes'), 'Reportes');
const Backup = lazyPage(() => import('./pages/finance/Backup'), 'Backup');
const Auditoria = lazyPage(() => import('./pages/finance/Auditoria'), 'Auditoria');
const UsuariosAdmin = lazyPage(() => import('./pages/finance/UsuariosAdmin'), 'UsuariosAdmin');

const LAST_PAGE_KEY = 'fintrack_last_page';
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
      const { data, error } = await getProfile(supabase, session.user.id);
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
      const { data, error } = await listUserPermissions(supabase, session.user.id);
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

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  const currentTitle = pageTitle(page, isAdmin);
  const dialogs = <AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} />;
  const pageContent = (
    <React.Suspense fallback={<div className="page-loader">Cargando módulo...</div>}>
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
    </React.Suspense>
  );

  return (
    <AppLayout
      pages={pages}
      page={page}
      profile={profile}
      user={session.user}
      isAdmin={isAdmin}
      isMobile={isMobile}
      sidebarHidden={sidebarHidden}
      sidebarOpen={sidebarOpen}
      offline={offline}
      currentTitle={currentTitle}
      updateWaiting={updateWaiting}
      installPrompt={installPrompt}
      message={message}
      search={<GlobalSearch supabase={supabase} user={session.user} onOpenPage={openPage} />}
      alerts={<AlertsButton supabase={supabase} user={session.user} open={alertsOpen} setOpen={setAlertsOpen} onOpenPage={openPage} />}
      onOpenPage={openPage}
      onLogout={logout}
      onToggleMobileSidebar={toggleMobileSidebar}
      onCloseMobileSidebar={() => setSidebarOpen(false)}
      onToggleSidebar={toggleSidebar}
      onApplyUpdate={applyUpdate}
      onInstall={installApp}
      dialogs={dialogs}
      LogoIcon={AppLogoIcon}
    >
      {pageContent}
    </AppLayout>
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
      if (debouncedQuery.trim().length < 2) {
        setResults([]);
        return;
      }
      const nextResults = await globalSearch(supabase, user.id, debouncedQuery);
      if (cancelled) return;
      setResults(nextResults);
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
      const alertData = await getAlertData(supabase, user.id);
      const debtAlerts = alertData.deudas
        .filter((d) => calcEstado(d) === 'vencido' || calcEstado(d) === 'por_vencer')
        .slice(0, 5)
        .map((d) => ({ page: d.tipo === 'Préstamo' ? 'prestamos' : 'deudas', level: calcEstado(d) === 'vencido' ? 'danger' : 'warning', title: calcEstado(d) === 'vencido' ? 'Pendiente vencido' : 'Pendiente por vencer', text: `${d.descripcion || 'Sin descripción'} · ${money(Number(d.monto_total || 0) - Number(d.monto_pagado || 0))}` }));
      const budgetAlerts = alertData.presupuestos.map((p) => {
        const used = alertData.movimientos
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
      const goalAlerts = alertData.metas
        .filter((m) => m.fecha_objetivo && m.fecha_objetivo <= today())
        .slice(0, 3)
        .map((m) => ({ page: 'metas', level: 'warning', title: 'Meta por revisar', text: `${m.nombre}: ${money(m.monto_actual)} / ${money(m.monto_objetivo)}` }));
      const lowBalanceAlerts = alertData.cuentas
        .filter((c) => Number(c.saldo || 0) <= 0)
        .slice(0, 3)
        .map((c) => ({ page: 'cuentas', level: 'warning', title: 'Saldo bajo', text: `${c.banco || 'Cuenta'} ${c.tipo || ''}: ${money(c.saldo || 0)}` }));
      const receivedLoanAlerts = alertData.prestamosRecibidos
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

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
