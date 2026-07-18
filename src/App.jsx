import React from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  BarChart3,
  Banknote,
  Building2,
  ClipboardList,
  CreditCard,
  Database,
  LayoutDashboard,
  Bell,
  CalendarCheck,
  ClipboardPlus,
  Tags,
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
import { LOCKED_KEY, REMEMBER_KEY } from './constants/authStorage';
import { clearRememberedAccount } from './controllers/auth.controller';
import { Auth, PasswordRecovery, PinUnlock } from './components/auth/Auth';
import { AppLayout } from './components/layout/AppLayout';
import { AppDialogs, AuthCard } from './components/ui';
import { Config } from './pages/Config';
import { usePermissions } from './hooks/usePermissions';
import { useVisualConfig } from './hooks/useVisualConfig';
import { clearFeedbackHandlers, confirmAction, hideBusy, notify, setFeedbackHandlers, showBusy } from './services/feedback';
import { getProfile } from './services/admin.service';
import { listInternalNotifications, syncAutomaticNotifications } from './services/notificationsCenter.service';
import { autoRegisterPushDevice, isNativePushSupported } from './services/push.service';
import { globalSearch } from './services/search.service';
import { storage } from './services/storage.service';
import { isMobileViewport } from './utils/security';
import { isNativeApp } from './services/platform.service';

const lazyPage = (loader, exportName) => React.lazy(() => loader().then((module) => ({ default: module[exportName] })));

const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'Dashboard');
const Perfil = lazyPage(() => import('./pages/Perfil'), 'Perfil');
const Seguridad = lazyPage(() => import('./pages/Seguridad'), 'Seguridad');
const Notificaciones = lazyPage(() => import('./pages/Notificaciones'), 'Notificaciones');
const CierreMensual = lazyPage(() => import('./pages/finance/CierreMensual'), 'CierreMensual');
const CajaDiaria = lazyPage(() => import('./pages/finance/CajaDiaria'), 'CajaDiaria');
const Plantillas = lazyPage(() => import('./pages/finance/Plantillas'), 'Plantillas');
const CategoriasInteligentes = lazyPage(() => import('./pages/finance/CategoriasInteligentes'), 'CategoriasInteligentes');
const Clientes = lazyPage(() => import('./pages/finance/Clientes'), 'Clientes');
const Cuentas = lazyPage(() => import('./pages/finance/Cuentas'), 'Cuentas');
const Deudas = lazyPage(() => import('./pages/finance/Deudas'), 'Deudas');
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
  'prestamos-recibidos',
  'pagos-prestamos-recibidos',
  'pagos',
  'movimientos',
  'presupuestos',
  'metas',
  'cierre-mensual',
  'caja-diaria',
  'plantillas',
  'categorias-inteligentes',
  'reportes',
  'backup',
  'auditoria',
  'perfil',
  'seguridad',
  'notificaciones',
  'usuarios-admin',
  'config',
];

function isRecoveryUrl() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return search.get('recovery') === '1' || search.get('type') === 'recovery' || hash.get('type') === 'recovery';
}

async function handleNativeAuthUrl(supabase, url) {
  if (!url || !supabase) return;
  const parsed = new URL(url);
  const query = new URLSearchParams(parsed.search);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const code = query.get('code') || hash.get('code');
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');

  if (query.get('recovery') === '1' || hash.get('type') === 'recovery' || query.get('type') === 'recovery') {
    window.history.replaceState({}, document.title, `${window.location.origin}?recovery=1`);
  }

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return;
  }

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }
}

function useGlobalButtonLoading() {
  React.useEffect(() => {
    const actionPattern = /guardar|actualizar|registrar|crear|agregar|transferir|cerrar caja|guardar cierre|editar|activar|desactivar|eliminar|permisos/i;

    function hasManagedLoading(button) {
      return (
        button.querySelector('.btn-spinner') ||
        button.dataset.loadingManaged === 'true' ||
        button.getAttribute('data-loading') === 'true'
      );
    }

    function shouldAnimate(button) {
      if (!button || button.closest('[data-no-global-loading="true"]')) return false;
      const label = `${button.textContent || ''} ${button.title || ''} ${button.getAttribute('aria-label') || ''}`.trim();
      return actionPattern.test(label);
    }

    function markLoading(button) {
      if (!button || button.disabled || button.getAttribute('aria-busy') === 'true' || hasManagedLoading(button)) return;
      button.classList.add('btn-loading');
      button.setAttribute('aria-busy', 'true');
      window.setTimeout(() => {
        button.classList.remove('btn-loading');
        if (!hasManagedLoading(button)) button.removeAttribute('aria-busy');
      }, 1200);
    }

    function handleSubmit(event) {
      const button = event.submitter;
      if (!button?.matches?.('button') || !shouldAnimate(button)) return;
      if (event.target?.checkValidity && !event.target.checkValidity()) return;
      markLoading(button);
    }

    function handleClick(event) {
      const button = event.target?.closest?.('button');
      if (!button || button.type === 'submit') return;
      if (!shouldAnimate(button)) return;
      markLoading(button);
    }

    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('submit', handleSubmit, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, []);
}

export function App() {
  useGlobalButtonLoading();
  const [supabase, setSupabase] = React.useState(createStoredClient);
  const [session, setSession] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [profile, setProfile] = React.useState(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [passwordRecovery, setPasswordRecovery] = React.useState(() => isRecoveryUrl());
  const [page, setPage] = React.useState(() => {
    const savedPage = storage.getRaw(LAST_PAGE_KEY);
    return PAGE_IDS.includes(savedPage) ? savedPage : 'dashboard';
  });
  const [message, setMessage] = React.useState('');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [toast, setToast] = React.useState(null);
  const [confirmState, setConfirmState] = React.useState(null);
  const [busy, setBusy] = React.useState({ active: false, message: '' });
  const [locked, setLocked] = React.useState(() => storage.getRaw(LOCKED_KEY) === '1');
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const nativePinPromptedRef = React.useRef(false);
  const { can, isAdmin } = usePermissions({ supabase, session, profile });
  const { companyConfig, installPrompt, sidebarHidden, updateWaiting, isMobile, offline, toggleSidebar, applyUpdate, installApp } = useVisualConfig(session?.user?.id);

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
    if (!supabase) return;
    setAuthReady(false);
    supabase.auth.getSession()
      .then(({ data }) => {
        const nextSession = data.session || null;
        setSession((current) => (current?.access_token === nextSession?.access_token ? current : nextSession));
      })
      .finally(() => setAuthReady(true));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setAuthReady(true);
      setSession((current) => (current?.access_token === nextSession?.access_token ? current : nextSession));
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setMessage('');
      }
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  React.useEffect(() => {
    if (!supabase || !isNativeApp()) return undefined;
    let listener;
    CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      handleNativeAuthUrl(supabase, url).catch((error) => {
        setMessage(error?.message || 'No se pudo procesar el enlace de confirmacion.');
      });
    }).then((handle) => {
      listener = handle;
    });
    return () => {
      listener?.remove();
    };
  }, [supabase]);

  React.useEffect(() => {
    async function loadProfile() {
      if (!supabase || !session?.user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      const shouldShowInitialLoader = !profile;
      if (shouldShowInitialLoader) setProfileLoading(true);
      const { data, error } = await getProfile(supabase, session.user.id);
      if (error || !data) {
        setMessage('Tu usuario ya no existe o fue eliminado del sistema.');
        clearRememberedAccount();
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      if (data.activo === false || data.deleted_at) {
        setMessage('Tu usuario esta desactivado. Contacta al administrador.');
        clearRememberedAccount();
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      setProfile(data);
      setProfileLoading(false);
    }
    loadProfile();
  }, [supabase, session?.user?.id, refreshKey]);

  React.useEffect(() => {
    if (locked && profile && !profile.pin_hash) {
      storage.remove(LOCKED_KEY);
      setLocked(false);
    }
  }, [locked, profile]);

  React.useEffect(() => {
    if (!isNativeApp() || !profile || locked || profile.pin_hash) return;
    if (page !== 'seguridad') {
      setPage('seguridad');
      storage.setRaw(LAST_PAGE_KEY, 'seguridad');
    }
    if (!nativePinPromptedRef.current) {
      notify('Configura un PIN para desbloquear la app movil.', 'warning');
      nativePinPromptedRef.current = true;
    }
  }, [locked, page, profile]);

  React.useEffect(() => {
    if (!isNativeApp() || !profile?.pin_hash || !session?.user || locked) return undefined;
    let listener;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        storage.setRaw(LOCKED_KEY, '1');
        setLocked(true);
      }
    }).then((handle) => {
      listener = handle;
    });
    return () => {
      listener?.remove?.();
    };
  }, [locked, profile?.pin_hash, session?.user?.id]);

  React.useEffect(() => {
    if (!supabase || !session?.user || locked) return undefined;
    let logoutTimer;
    let warningTimer;
    const resetTimers = () => {
      window.clearTimeout(logoutTimer);
      window.clearTimeout(warningTimer);
      warningTimer = window.setTimeout(() => notify('Tu sesion se cerrara en 1 minuto por inactividad.', 'warning'), INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS);
      logoutTimer = window.setTimeout(async () => {
        await supabase.auth.signOut();
        storage.remove(LOCKED_KEY);
        setSession(null);
        setProfile(null);
        notify('Sesion cerrada por inactividad.', 'success');
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
    if (!profile || locked) return;
    const timer = window.setTimeout(() => {
      import('./pages/Dashboard');
      import('./pages/finance/Clientes');
      import('./pages/finance/Cuentas');
      import('./pages/finance/Movimientos');
      import('./pages/finance/Reportes');
    }, 800);
    return () => window.clearTimeout(timer);
  }, [profile, locked]);

  React.useEffect(() => {
    if (!supabase || !session?.user || !profile || locked || !isNativePushSupported()) return;
    autoRegisterPushDevice(supabase, session.user.id).catch(() => {
      // El usuario puede denegar el permiso del sistema; no debe bloquear el ingreso.
    });
  }, [supabase, session?.user?.id, profile?.id, locked]);

  if (!supabase) return <><Setup onReady={setSupabase} /><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  if (!authReady) return <><AuthCard title="FinTrack Pro"><p className="muted">{isNativeApp() ? 'Preparando app...' : 'Validando sesion...'}</p></AuthCard><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  if (passwordRecovery && session) {
    return <><PasswordRecovery supabase={supabase} onComplete={(nextMessage) => {
      setPasswordRecovery(false);
      setSession(null);
      setProfile(null);
      setMessage(nextMessage);
      window.history.replaceState({}, document.title, window.location.origin);
    }} /><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  }
  if (!session) return <><Auth supabase={supabase} message={message} setMessage={setMessage} /><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
  if (!profile) return <><AuthCard title="FinTrack Pro"><p className="muted">{profileLoading ? 'Validando acceso...' : 'Cargando perfil...'}</p></AuthCard><AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} /></>;
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

  const pages = [
    ['principal', [
      ['dashboard', 'Dashboard', LayoutDashboard, can('dashboard')],
      ['clientes', 'Clientes', Users, can('clientes')],
    ]],
    ['dinero', [
      ['cuentas', 'Cuentas y caja', Building2, can('cuentas')],
      ['movimientos', 'Movimientos de caja', Wallet, can('movimientos')],
      ['caja-diaria', 'Caja diaria', CalendarCheck, can('movimientos')],
      ['plantillas', 'Plantillas', ClipboardPlus, can('movimientos')],
      ['categorias-inteligentes', 'Categorias inteligentes', Tags, can('movimientos')],
    ]],
    ['cobros', [
      ['deudas', 'Cuentas por cobrar', CreditCard, can('deudas')],
      ['pagos', 'Cobros recibidos', Banknote, can('pagos')],
    ]],
    ['por pagar', [
      ['prestamos-recibidos', 'Prestamos por pagar', Banknote, can('prestamos-recibidos')],
      ['pagos-prestamos-recibidos', 'Pagos a acreedores', TrendingDown, can('pagos-prestamos-recibidos')],
    ]],
    ['planificacion', [
      ['presupuestos', 'Presupuestos', ClipboardList, can('presupuestos')],
      ['metas', 'Metas', Target, can('metas')],
      ['cierre-mensual', 'Cierre mensual', CalendarCheck, can('reportes')],
    ]],
    ['analisis', [
      ['reportes', 'Reportes', BarChart3, can('reportes')],
      ['backup', 'Backup', Database, can('backup')],
      ['auditoria', 'Auditoria', ShieldCheck, can('auditoria')],
    ]],
    ['sistema', [
      ['perfil', 'Mi perfil', UserCircle, true],
      ['seguridad', 'Seguridad', ShieldCheck, true],
      ['notificaciones', 'Notificaciones', Bell, true],
      ['usuarios-admin', 'Usuarios', Users, isAdmin],
      ['config', 'Configuracion', Settings, isAdmin],
    ]],
  ];

  async function logout() {
    const canLock = (isNativeApp() || (isMobileViewport() && storage.getRaw(REMEMBER_KEY) === '1')) && profile?.pin_hash;
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
    if (!can(nextPage, 'view')) return notify('No tienes permiso para ver este modulo.');
    setPage(nextPage);
    setSidebarOpen(false);
  }

  function toggleMobileSidebar() {
    setAlertsOpen(false);
    setSidebarOpen((current) => !current);
  }

  const currentTitle = pageTitle(page, isAdmin);
  const dialogs = <AppDialogs toast={toast} onCloseToast={() => setToast(null)} confirmState={confirmState} setConfirmState={setConfirmState} busy={busy} />;
  const pageContent = (
    <React.Suspense fallback={<div className="page-loader">Cargando modulo...</div>}>
      <div className={`page active page-${page}`}>
        {page === 'dashboard' && <Dashboard supabase={supabase} user={session.user} isAdmin={isAdmin} />}
        {page === 'clientes' && <Clientes supabase={supabase} user={session.user} can={(action) => can('clientes', action)} />}
        {page === 'cuentas' && <Cuentas supabase={supabase} user={session.user} can={(action) => can('cuentas', action)} />}
        {page === 'deudas' && <Deudas supabase={supabase} user={session.user} isAdmin={isAdmin} can={(action) => can('deudas', action)} />}
        {page === 'prestamos-recibidos' && <PrestamosRecibidos supabase={supabase} user={session.user} can={(action) => can('prestamos-recibidos', action)} />}
        {page === 'pagos-prestamos-recibidos' && <PagosPrestamosRecibidos supabase={supabase} user={session.user} can={(action) => can('pagos-prestamos-recibidos', action)} />}
        {page === 'pagos' && <Pagos supabase={supabase} user={session.user} isAdmin={isAdmin} can={(action) => can('pagos', action)} />}
        {page === 'movimientos' && <Movimientos supabase={supabase} user={session.user} isAdmin={isAdmin} can={(action) => can('movimientos', action)} />}
        {page === 'caja-diaria' && <CajaDiaria supabase={supabase} user={session.user} can={(action) => can('movimientos', action)} />}
        {page === 'plantillas' && <Plantillas supabase={supabase} user={session.user} can={(action) => can('movimientos', action)} />}
        {page === 'categorias-inteligentes' && <CategoriasInteligentes supabase={supabase} user={session.user} can={(action) => can('movimientos', action)} />}
        {page === 'presupuestos' && <Presupuestos supabase={supabase} user={session.user} can={(action) => can('presupuestos', action)} />}
        {page === 'metas' && <Metas supabase={supabase} user={session.user} can={(action) => can('metas', action)} />}
        {page === 'cierre-mensual' && <CierreMensual supabase={supabase} user={session.user} can={(action) => can('reportes', action)} />}
        {page === 'reportes' && <Reportes supabase={supabase} user={session.user} can={(action) => can('reportes', action)} />}
        {page === 'backup' && <Backup supabase={supabase} user={session.user} can={(action) => can('backup', action)} />}
        {page === 'auditoria' && <Auditoria supabase={supabase} user={session.user} can={(action) => can('auditoria', action)} />}
        {page === 'perfil' && <Perfil supabase={supabase} user={session.user} profile={profile} onSaved={() => setRefreshKey((x) => x + 1)} />}
        {page === 'seguridad' && <Seguridad supabase={supabase} user={session.user} profile={profile} onSaved={() => setRefreshKey((x) => x + 1)} />}
        {page === 'notificaciones' && <Notificaciones supabase={supabase} user={session.user} isAdmin={isAdmin} />}
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
      logoutLabel={isNativeApp() && profile?.pin_hash ? 'Bloquear app' : 'Cerrar sesión'}
      onToggleMobileSidebar={toggleMobileSidebar}
      onCloseMobileSidebar={() => setSidebarOpen(false)}
      onToggleSidebar={toggleSidebar}
      onApplyUpdate={applyUpdate}
      onInstall={installApp}
      dialogs={dialogs}
      LogoIcon={AppLogoIcon}
      logoUrl={companyConfig.logo_url}
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
    cuentas: ['Cuentas y caja', 'Administra tus cuentas bancarias y billeteras'],
    deudas: ['Cuentas por cobrar', 'Ventas, servicios y prestamos que deben pagarte'],
    'prestamos-recibidos': ['Prestamos por pagar', 'Dinero que te prestaron y aun debes'],
    'pagos-prestamos-recibidos': ['Pagos a acreedores', 'Pagos realizados por prestamos que debes'],
    pagos: ['Cobros recibidos', 'Dinero recibido de clientes o deudores'],
    movimientos: ['Movimientos de caja', 'Ingresos y egresos generales'],
    'caja-diaria': ['Caja diaria', 'Resumen y cierre operativo del dia'],
    plantillas: ['Plantillas', 'Movimientos frecuentes reutilizables'],
    'categorias-inteligentes': ['Categorias inteligentes', 'Reglas para sugerir categorias por concepto'],
    presupuestos: ['Presupuestos', 'Control mensual por categoria'],
    metas: ['Metas financieras', 'Objetivos de ahorro y crecimiento'],
    'cierre-mensual': ['Cierre mensual', 'Snapshot financiero por mes'],
    reportes: ['Reportes', 'Analisis financiero'],
    backup: ['Backup', 'Exportacion de datos'],
    auditoria: ['Auditoria', 'Historial de acciones importantes'],
    perfil: ['Mi perfil', 'Informacion personal'],
    seguridad: ['Seguridad', 'PIN movil y contrasena'],
    notificaciones: ['Notificaciones', 'Alertas push del dispositivo'],
    'usuarios-admin': ['Usuarios', 'Activacion y control de accesos'],
    config: ['Configuracion', 'Conexion a base de datos'],
  };
  return labels[page] || ['FinTrack', ''];
}function AppLogoIcon({ size = 22 }) {
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
    let mounted = true;
    async function load() {
      await syncAutomaticNotifications(supabase, user.id);
      const { data, error } = await listInternalNotifications(supabase, user.id);
      if (!mounted) return;
      if (error) {
        setAlerts([]);
        return;
      }
      setAlerts((data || []).filter((alert) => !alert.leida));
    }
    load();
    const interval = window.setInterval(load, 10 * 60 * 1000);
    const refreshOnFocus = () => load();
    const refreshOnVisibility = () => {
      if (!document.hidden) load();
    };
    window.addEventListener('fintrack:notifications-changed', load);
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    const channel = supabase
      .channel(`app-notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_notifications', filter: `admin_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener('fintrack:notifications-changed', load);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
      supabase.removeChannel(channel);
    };
  }, [supabase, user.id]);
  return (
    <div className="alerts-menu">
      <button className={`btn btn-icon alerts-button ${alerts.length ? 'has-new' : ''}`} type="button" onClick={() => setOpen(!open)} title="Alertas" aria-label={`Alertas${alerts.length ? `: ${alerts.length}` : ''}`}>
        <Bell size={24} className={alerts.length ? 'bell-icon-animated' : ''} />
        {!!alerts.length && <span className="alerts-count">{alerts.length > 99 ? '99+' : alerts.length}</span>}
      </button>
      {open && (
        <div className="alerts-panel">
          <h4>Alertas</h4>
          {alerts.length ? alerts.map((alert, index) => (
            <button key={alert.id || `${alert.titulo}-${index}`} type="button" onClick={() => { onOpenPage(alert.modulo || 'notificaciones'); setOpen(false); }}>
              <b className={alert.tipo === 'danger' ? 'danger-text' : ''}>{alert.titulo}</b>
              <small>{alert.mensaje}</small>
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

export default App;
