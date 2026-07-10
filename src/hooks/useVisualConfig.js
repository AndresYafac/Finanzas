import React from 'react';
import { applyVisualConfig, getCompanyConfig, getVisualConfig } from '../config/visualConfig';
import { storage } from '../services/storage.service';
import { isMobileViewport } from '../utils/security';

export function useVisualConfig(userId) {
  const [installPrompt, setInstallPrompt] = React.useState(null);
  const [sidebarHidden, setSidebarHidden] = React.useState(() => storage.getRaw('fintrack_sidebar_hidden') === '1');
  const [updateWaiting, setUpdateWaiting] = React.useState(null);
  const [isMobile, setIsMobile] = React.useState(() => isMobileViewport());
  const [offline, setOffline] = React.useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [companyConfig, setCompanyConfig] = React.useState(getCompanyConfig);

  React.useEffect(() => {
    const syncVisualConfig = () => applyVisualConfig(getVisualConfig(userId));
    syncVisualConfig();
    window.addEventListener('fintrack_visual_config', syncVisualConfig);
    return () => window.removeEventListener('fintrack_visual_config', syncVisualConfig);
  }, [userId]);

  React.useEffect(() => {
    const syncCompanyConfig = () => setCompanyConfig(getCompanyConfig());
    syncCompanyConfig();
    window.addEventListener('fintrack_company_config', syncCompanyConfig);
    return () => window.removeEventListener('fintrack_company_config', syncCompanyConfig);
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
          if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdateWaiting(worker);
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

  const toggleSidebar = React.useCallback(() => {
    setSidebarHidden((current) => {
      const next = !current;
      storage.setRaw('fintrack_sidebar_hidden', next ? '1' : '0');
      return next;
    });
  }, []);

  const applyUpdate = React.useCallback(() => {
    if (!updateWaiting) return;
    updateWaiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }, [updateWaiting]);

  const installApp = React.useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }, [installPrompt]);

  return { companyConfig, installPrompt, sidebarHidden, updateWaiting, isMobile, offline, toggleSidebar, applyUpdate, installApp };
}
