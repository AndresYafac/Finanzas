import React from 'react';
import { Banknote, CreditCard, Download, LogOut, Menu, Plus, RefreshCw, Target, UserPlus, Wallet } from 'lucide-react';
import { Button } from '../ui';
import { useOfflineSync } from '../../hooks/useOfflineSync';

function initials(profile, email) {
  return ((profile?.nombre?.[0] || '') + (profile?.apellido?.[0] || '')).toUpperCase() || email?.[0]?.toUpperCase() || '?';
}

function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
}

export function Sidebar({ pages, page, profile, user, isAdmin, sidebarOpen, onOpenPage, onLogout, LogoIcon, logoUrl }) {
  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="brand">
          <div className="brand-icon">
            {logoUrl ? <img src={logoUrl} alt="Logo de FinTrack" /> : <LogoIcon />}
          </div>
          <div>
            <div className="brand-name">FinTrack Pro</div>
            <div className="brand-sub">Panel de control</div>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {pages.map(([section, items]) => {
          const visibleItems = items.filter(([, , , visible]) => visible);
          if (!visibleItems.length) return null;

          return (
            <React.Fragment key={section}>
              <div className="nav-section-label">{section}</div>
              {visibleItems.map(([id, label, Icon]) => (
                <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => onOpenPage(id)}>
                  <Icon size={18} /> {label}
                </button>
              ))}
            </React.Fragment>
          );
        })}
        <button className="nav-item logout" onClick={onLogout}><LogOut size={18} /> Cerrar sesión</button>
      </nav>
      <div className="sidebar-footer">
        <div className="user-mini" onClick={() => onOpenPage('perfil')}>
          <div className="user-avatar">{initials(profile, user.email)}</div>
          <div className="user-info">
            <div className="name">{fullName(profile) || user.email}</div>
            <div className="role">{isAdmin ? 'Administrador' : 'Usuario'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Topbar({
  isMobile,
  currentTitle,
  sidebarHidden,
  updateWaiting,
  installPrompt,
  onToggleMobileSidebar,
  onToggleSidebar,
  onApplyUpdate,
  onInstall,
  onLogout,
  search,
  alerts,
}) {
  return (
    <div className="topbar">
      {isMobile ? (
        <>
          <div className="topbar-left">
            <Button iconOnly className="mobile-menu-button" onClick={onToggleMobileSidebar} title="Menú" aria-label="Abrir menú">
              <Menu size={24} />
            </Button>
            <div>
              <h2>{currentTitle[0]}</h2>
              <p>{currentTitle[1]}</p>
            </div>
          </div>
          <div className="topbar-mobile-actions">
            {alerts}
            {updateWaiting && <Button iconOnly onClick={onApplyUpdate} title="Actualizar app" aria-label="Actualizar app"><RefreshCw size={18} /></Button>}
            {installPrompt && <Button iconOnly variant="primary" title="Instalar app" aria-label="Instalar app" onClick={onInstall}><Download size={18} /></Button>}
            <Button iconOnly className="mobile-logout-btn" onClick={onLogout} title="Salir" aria-label="Salir"><LogOut size={18} /></Button>
          </div>
          <div className="topbar-mobile-search">{search}</div>
        </>
      ) : (
        <>
          <div className="topbar-left">
            <Button iconOnly className="sidebar-toggle" onClick={onToggleSidebar} title={sidebarHidden ? 'Mostrar menú' : 'Ocultar menú'}>
              <Menu size={24} />
            </Button>
            <div>
              <h2>{currentTitle[0]}</h2>
              <p>{currentTitle[1]}</p>
            </div>
          </div>
          <div className="topbar-actions">
            {search}
            {alerts}
            {updateWaiting && <Button onClick={onApplyUpdate}><RefreshCw size={16} />Actualizar app</Button>}
            {installPrompt && <Button variant="primary" onClick={onInstall}><Download size={16} />Instalar app</Button>}
          </div>
        </>
      )}
    </div>
  );
}

export function AppLayout({
  children,
  pages,
  page,
  profile,
  user,
  isAdmin,
  isMobile,
  sidebarHidden,
  sidebarOpen,
  offline,
  currentTitle,
  updateWaiting,
  installPrompt,
  message,
  search,
  alerts,
  onOpenPage,
  onLogout,
  onToggleMobileSidebar,
  onCloseMobileSidebar,
  onToggleSidebar,
  onApplyUpdate,
  onInstall,
  dialogs,
  LogoIcon,
  logoUrl,
}) {
  const [quickOpen, setQuickOpen] = React.useState(false);
  const { pendingCount } = useOfflineSync();
  const quickActions = [
    ['clientes', 'Nuevo cliente', UserPlus],
    ['cuentas', 'Nueva cuenta', Wallet],
    ['movimientos', 'Movimiento', Banknote],
    ['deudas', 'Cuenta por cobrar', Plus],
    ['pagos', 'Registrar cobro', CreditCard],
    ['metas', 'Nueva meta', Target],
  ];
  React.useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setQuickOpen((value) => !value);
      }
      if (event.key === 'Escape') setQuickOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <div className={`layout ${sidebarHidden ? 'sidebar-hidden' : ''} ${isMobile ? 'layout-mobile' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className={`offline-indicator ${offline || pendingCount ? 'visible' : ''}`}>
        {offline ? 'Sin conexion. Las operaciones pendientes se sincronizaran al volver la conexion.' : `${pendingCount} operaciones pendientes por sincronizar.`}
      </div>
      {isMobile && <button className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} type="button" aria-label="Cerrar menú" onClick={onCloseMobileSidebar} />}
      <Sidebar pages={pages} page={page} profile={profile} user={user} isAdmin={isAdmin} sidebarOpen={sidebarOpen} onOpenPage={onOpenPage} onLogout={onLogout} LogoIcon={LogoIcon} logoUrl={logoUrl} />
      <main className="main">
        <Topbar
          isMobile={isMobile}
          currentTitle={currentTitle}
          sidebarHidden={sidebarHidden}
          updateWaiting={updateWaiting}
          installPrompt={installPrompt}
          onToggleMobileSidebar={onToggleMobileSidebar}
          onToggleSidebar={onToggleSidebar}
          onApplyUpdate={onApplyUpdate}
          onInstall={onInstall}
          onLogout={onLogout}
          search={search}
          alerts={alerts}
        />
        {message && <div className="alert alert-danger">{message}</div>}
        {children}
      </main>
      {isMobile && (
        <div className={`quick-actions ${quickOpen ? 'open' : ''}`}>
          {quickOpen && (
            <div className="quick-actions-menu">
              {quickActions.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onOpenPage(id);
                    setQuickOpen(false);
                  }}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
          <button className="quick-actions-toggle" type="button" onClick={() => setQuickOpen((value) => !value)} aria-label="Acciones rapidas" title="Acciones rapidas">
            <Plus size={24} />
          </button>
        </div>
      )}
      {dialogs}
    </div>
  );
}
