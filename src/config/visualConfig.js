import { storage } from '../services/storage.service';

export const COMPANY_CONFIG_KEY = 'fintrack_company_config';

export const DEFAULT_COMPANY_CONFIG = {
  nombre: 'FinTrack Pro',
  documento: '',
  direccion: '',
  telefono: '',
  logo_url: '',
  primary_color: '#1d9e75',
  accent_color: '#378add',
  theme: 'light',
  visual_style: 'aurora',
  surface_style: 'glass',
  density: 'comfortable',
};

function hexToRgb(hex, fallback = '29, 158, 117') {
  const clean = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return fallback;
  const value = Number.parseInt(clean, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

export function getCompanyConfig() {
  try {
    return { ...DEFAULT_COMPANY_CONFIG, ...(storage.getJson(COMPANY_CONFIG_KEY, {}) || {}) };
  } catch {
    return DEFAULT_COMPANY_CONFIG;
  }
}

export function applyVisualConfig(config = getCompanyConfig()) {
  const root = document.documentElement;
  const merged = { ...DEFAULT_COMPANY_CONFIG, ...config };
  root.dataset.theme = merged.theme === 'dark' ? 'dark' : 'light';
  root.dataset.visualStyle = merged.visual_style || DEFAULT_COMPANY_CONFIG.visual_style;
  root.dataset.surfaceStyle = merged.surface_style || DEFAULT_COMPANY_CONFIG.surface_style;
  root.dataset.density = merged.density || DEFAULT_COMPANY_CONFIG.density;
  root.style.setProperty('--primary', merged.primary_color || DEFAULT_COMPANY_CONFIG.primary_color);
  root.style.setProperty('--primary-rgb', hexToRgb(merged.primary_color, '29, 158, 117'));
  root.style.setProperty('--accent', merged.accent_color || DEFAULT_COMPANY_CONFIG.accent_color);
  root.style.setProperty('--accent-rgb', hexToRgb(merged.accent_color, '55, 138, 221'));
}
