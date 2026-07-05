import { storage } from '../services/storage.service';

export const COMPANY_CONFIG_KEY = 'fintrack_company_config';

export const DEFAULT_COMPANY_CONFIG = {
  nombre: 'FinTrack Pro',
  documento: '',
  direccion: '',
  telefono: '',
  logo_url: '',
  primary_color: '#1d9e75',
  theme: 'light',
};

export function getCompanyConfig() {
  try {
    return { ...DEFAULT_COMPANY_CONFIG, ...(storage.getJson(COMPANY_CONFIG_KEY, {}) || {}) };
  } catch {
    return DEFAULT_COMPANY_CONFIG;
  }
}

export function applyVisualConfig(config = getCompanyConfig()) {
  const root = document.documentElement;
  root.dataset.theme = config.theme === 'dark' ? 'dark' : 'light';
  root.style.setProperty('--primary', config.primary_color || DEFAULT_COMPANY_CONFIG.primary_color);
}
