import React from 'react';
import { Download, LogOut, Menu, RefreshCw } from 'lucide-react';
import { Button } from '../ui';

function initials(profile, email) {
  return ((profile?.nombre?.[0] || '') + (profile?.apellido?.[0] || '')).toUpperCase() || email?.[0]?.toUpperCase() || '?';
}

function fullName(profile) {
  return [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
}

export function Sidebar({ pages, page, profile, user, isAdmin, sidebarOpen, onOpenPage, onLogout, LogoIcon }) {
  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="brand">
          <div className="brand-icon"><LogoIcon /></div>
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
              <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => onOpenPage(id)}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </React.Fragment>
        ))}
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
}) {
  return (
    <div className={`layout ${sidebarHidden ? 'sidebar-hidden' : ''} ${isMobile ? 'layout-mobile' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className={`offline-indicator ${offline ? 'visible' : ''}`}>Sin conexión. Algunas funciones pueden no estar disponibles.</div>
      {isMobile && <button className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} type="button" aria-label="Cerrar menú" onClick={onCloseMobileSidebar} />}
      <Sidebar pages={pages} page={page} profile={profile} user={user} isAdmin={isAdmin} sidebarOpen={sidebarOpen} onOpenPage={onOpenPage} onLogout={onLogout} LogoIcon={LogoIcon} />
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
      {dialogs}
    </div>
  );
}
